# Candor On-Chain Architecture

## Program Details

- **Program ID:** `HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw` (devnet)
- **Framework:** Anchor 0.28.0 (pinned — only version compatible with React Native)
- **web3.js:** v1 only (v2 incompatible with Anchor)
- **Location:** `programs/candor/src/lib.rs`

---

## Critical MWA Compatibility Rules

The mobile client uses **manual buffer construction** — NOT the Anchor.js `Program` class. This is non-negotiable for MWA compatibility.

```typescript
// ❌ NEVER do this in mobile client
const tx = await program.methods.verifyPhoto(...).rpc();

// ✅ ALWAYS do this — manual instruction construction
import { buildVerifyPhotoInstruction } from '../services/anchor';
const ix = buildVerifyPhotoInstruction({ imageHash, lat, lng, timestamp });
const tx = new Transaction().add(ix);
// Then send via MWA transact()
```

Instruction discriminators are **hardcoded SHA-256 prefixes**, not derived at runtime.

---

## Existing Instructions

### `verify_photo`

Creates a `PhotoRecord` PDA. Immutable after creation.

**PDA seeds:** `[b"photo", creator_pubkey, image_hash_bytes]`

**Accounts:**
- `photo_record` — PDA (init, payer=creator, space=PhotoRecord::LEN)
- `creator` — signer, mut
- `system_program`

**Data stored in PhotoRecord:**
```rust
pub struct PhotoRecord {
    pub creator: Pubkey,           // 32
    pub image_hash: [u8; 32],      // 32 — SHA-256 of raw image bytes
    pub latitude: i64,             // 8 — actual_lat * 10^7, fuzzed to ~111m
    pub longitude: i64,            // 8
    pub timestamp: i64,            // 8 — Unix timestamp
    pub bump: u8,                  // 1
}
```

**Client usage** (from `src/services/anchor.ts`):
```typescript
buildVerifyPhotoInstruction({
  imageHash: Uint8Array(32),  // SHA-256 computed via expo-crypto
  latitude: Math.round(lat * 1e7),   // fixed-point
  longitude: Math.round(lng * 1e7),
  timestamp: Math.floor(Date.now() / 1000),
  creatorPubkey: new PublicKey(walletAddress),
})
```

---

### `vouch`

Creates a `VouchRecord` PDA + SOL transfer from voucher to creator.

**PDA seeds:** `[b"vouch", voucher_pubkey, photo_record_pubkey]`
PDA uniqueness enforces **one vouch per user per photo**.

**Validation:**
- Self-vouching rejected (`require!(voucher.key() != creator.key())`)
- Already vouched: TX fails (PDA already exists → AccountAlreadyInUse error)

**Accounts:**
- `vouch_record` — PDA (init)
- `photo_record` — existing PhotoRecord (to find creator)
- `voucher` — signer, mut
- `creator` — mut (receives SOL)
- `system_program`

**Data stored in VouchRecord:**
```rust
pub struct VouchRecord {
    pub voucher: Pubkey,
    pub photo_record: Pubkey,
    pub amount: u64,   // lamports transferred
    pub timestamp: i64,
    pub bump: u8,
}
```

---

## Adding New Instructions

When adding a new Anchor instruction, follow this pattern:

### 1. Add to lib.rs
```rust
pub fn new_instruction(ctx: Context<NewInstruction>, param: Type) -> Result<()> {
    // validation
    require!(condition, CandorError::SomeError);
    
    // state changes
    let record = &mut ctx.accounts.new_record;
    record.field = param;
    record.creator = ctx.accounts.signer.key();
    record.bump = ctx.bumps.new_record;
    
    Ok(())
}

#[derive(Accounts)]
pub struct NewInstruction<'info> {
    #[account(
        init,
        payer = signer,
        space = NewRecord::LEN,
        seeds = [b"new_seed", signer.key().as_ref()],
        bump
    )]
    pub new_record: Account<'info, NewRecord>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 2. Compute discriminator (for manual client construction)
```typescript
// In src/services/anchor.ts
// Discriminator = first 8 bytes of SHA-256("global:instruction_name")
import { sha256 } from 'js-sha256';
const discriminator = Buffer.from(
  sha256.array(`global:new_instruction`).slice(0, 8)
);
```

### 3. Build instruction manually
```typescript
export function buildNewInstruction(params: {
  signerPubkey: PublicKey;
  param: SomeType;
}): TransactionInstruction {
  const [recordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('new_seed'), params.signerPubkey.toBuffer()],
    CANDOR_PROGRAM_ID
  );

  const data = Buffer.alloc(8 + PARAM_SIZE);
  discriminator.copy(data, 0);
  // encode param at offset 8
  
  return new TransactionInstruction({
    programId: CANDOR_PROGRAM_ID,
    keys: [
      { pubkey: recordPda, isSigner: false, isWritable: true },
      { pubkey: params.signerPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
```

### 4. Send via MWA
```typescript
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

const sig = await transact(async (wallet) => {
  const authResult = await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
  const tx = new Transaction().add(buildNewInstruction(params));
  tx.feePayer = new PublicKey(authResult.accounts[0].address);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await wallet.signAndSendTransactions({ transactions: [tx] });
  return signed[0];
});
```

---

## Error Handling Patterns

```rust
#[error_code]
pub enum CandorError {
    #[msg("Cannot vouch for your own photo")]
    SelfVouch,
    #[msg("Photo has already been verified")]
    AlreadyVerified,
    #[msg("Insufficient balance for vouch")]
    InsufficientBalance,
}
```

Client-side: check for `AccountAlreadyInUse` error to detect duplicate vouch. Check for custom error codes using Anchor error discriminators.

---

## Supabase Integration Pattern

On-chain confirmation → Supabase insert (always in this order):
```
1. Build TX + sign via MWA
2. Get confirmation from Solana (waitForConfirmation)
3. ONLY THEN: insert into Supabase (photos / vouches table)
4. Supabase as source of truth for UI, not on-chain polling
```

Never insert into Supabase before on-chain confirmation. If on-chain fails, no DB record.

---

## Common Pitfalls

- **Never import from `@coral-xyz/anchor` the `Program` class in RN** — bundler issues + MWA incompatible
- **web3.js v1 only** — any v2 import will break Anchor
- **Buffer availability** — always import from polyfills (`import { Buffer } from 'buffer'`)
- **PDA derivation** — always use `PublicKey.findProgramAddressSync` (sync version) in client, not async
- **Lamports** — vouch amounts are in lamports (1 SOL = 1_000_000_000 lamports)
- **GPS fixed-point** — multiply by 1e7 before storing, divide by 1e7 when reading
