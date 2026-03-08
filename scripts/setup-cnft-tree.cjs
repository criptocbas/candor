/**
 * One-time setup script: Create a public Merkle tree on devnet for Candor cNFTs.
 *
 * Usage: node scripts/setup-cnft-tree.cjs
 *
 * Uses the Solana CLI default keypair (~/.config/solana/id.json) as the payer.
 * Creates a Bubblegum-compatible concurrent Merkle tree (capacity: 16,384 cNFTs).
 * Set to "public" so any user can mint their verified photos as cNFTs.
 *
 * After running, copy the printed tree address into src/services/cnft.ts.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} = require("@solana/web3.js");

// ─── Constants ───────────────────────────────────────────────────────────────

const BUBBLEGUM_PROGRAM_ID = new PublicKey(
  "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
);
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
);
const SPL_NOOP_PROGRAM_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

const MAX_DEPTH = 14;
const MAX_BUFFER_SIZE = 64;

// getConcurrentMerkleTreeAccountSize(14, 64, 0) = 31800
const TREE_ACCOUNT_SIZE = 31800;

// SHA-256("global:create_tree")[0..8]
const CREATE_TREE_DISCRIMINATOR = Buffer.from([165, 83, 136, 142, 89, 202, 47, 220]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadKeypairFromFile(filePath) {
  const resolved = filePath.replace("~", os.homedir());
  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Load payer from Solana CLI default keypair
  const payerPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const payer = loadKeypairFromFile(payerPath);
  console.log("Payer:", payer.publicKey.toBase58());

  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  const treeKeypair = Keypair.generate();
  console.log("Tree keypair:", treeKeypair.publicKey.toBase58());

  const lamports = await connection.getMinimumBalanceForRentExemption(TREE_ACCOUNT_SIZE);
  console.log(`\nTree account: ${TREE_ACCOUNT_SIZE} bytes, ${lamports / 1e9} SOL rent`);

  if (balance < lamports + 10_000_000) {
    console.error("Insufficient balance! Need at least", (lamports + 10_000_000) / 1e9, "SOL");
    process.exit(1);
  }

  // Derive tree authority PDA
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [treeKeypair.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  );

  // Instruction 1: Allocate tree account
  const allocIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: treeKeypair.publicKey,
    lamports,
    space: TREE_ACCOUNT_SIZE,
    programId: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  });

  // Instruction 2: Bubblegum create_tree
  const data = Buffer.alloc(8 + 4 + 4 + 2);
  CREATE_TREE_DISCRIMINATOR.copy(data, 0);
  data.writeUInt32LE(MAX_DEPTH, 8);
  data.writeUInt32LE(MAX_BUFFER_SIZE, 12);
  data[16] = 1; // Some
  data[17] = 1; // true (public)

  const createTreeIx = new TransactionInstruction({
    keys: [
      { pubkey: treeAuthority, isSigner: false, isWritable: true },
      { pubkey: treeKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: BUBBLEGUM_PROGRAM_ID,
    data,
  });

  console.log("\nCreating Merkle tree...");
  const tx = new Transaction().add(allocIx, createTreeIx);
  tx.feePayer = payer.publicKey;

  const sig = await sendAndConfirmTransaction(connection, tx, [payer, treeKeypair], {
    commitment: "confirmed",
  });

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  MERKLE TREE CREATED SUCCESSFULLY");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Address:   ${treeKeypair.publicKey.toBase58()}`);
  console.log(`  Authority: ${treeAuthority.toBase58()}`);
  console.log(`  Capacity:  ${Math.pow(2, MAX_DEPTH).toLocaleString()} cNFTs`);
  console.log(`  Public:    true`);
  console.log(`  Tx:        ${sig}`);
  console.log("════════════════════════════════════════════════════════════");
  console.log("\n  Copy the address above into src/services/cnft.ts\n");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
