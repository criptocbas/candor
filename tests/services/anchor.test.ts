import { PublicKey, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";

// Mock supabase (cnft.ts imports it at module level via supabase.ts → react-native-url-polyfill)
jest.mock("../../src/services/supabase", () => ({
  supabase: {},
  PHOTOS_BUCKET: "photos",
}));

import {
  buildVerifyPhotoTransaction,
  buildVouchTransaction,
} from "../../src/services/anchor";
import { PROGRAM_ID, getPhotoRecordPDA, getVouchRecordPDA } from "../../src/services/solana";

// ─── Discriminator Verification ─────────────────────────────────────────────

describe("instruction discriminators", () => {
  function computeDiscriminator(instructionName: string): Buffer {
    const hash = createHash("sha256")
      .update(`global:${instructionName}`)
      .digest();
    return hash.slice(0, 8);
  }

  it("verify_photo discriminator matches SHA-256('global:verify_photo')[0..8]", () => {
    const expected = computeDiscriminator("verify_photo");
    expect(Array.from(expected)).toEqual([0xa6, 0x53, 0x75, 0xc7, 0xc3, 0x30, 0xad, 0x44]);
  });

  it("vouch discriminator matches SHA-256('global:vouch')[0..8]", () => {
    const expected = computeDiscriminator("vouch");
    expect(Array.from(expected)).toEqual([0x57, 0xf0, 0x08, 0x15, 0xdb, 0xb3, 0xf2, 0xb1]);
  });
});

// ─── buildVerifyPhotoTransaction ────────────────────────────────────────────

describe("buildVerifyPhotoTransaction", () => {
  const creator = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
  const imageHash = Array.from(Buffer.alloc(32, 0xab));
  const latitude = 40.7128;
  const longitude = -74.006;
  const timestamp = 1700000000;
  const blockhash = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

  it("builds a transaction with correct structure", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash
    );

    expect(tx.recentBlockhash).toBe(blockhash);
    expect(tx.feePayer!.equals(creator)).toBe(true);
    // 2 compute budget instructions + 1 verify_photo instruction
    expect(tx.instructions).toHaveLength(3);
  });

  it("sets compute budget to 200,000 CU without cNFT", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash
    );
    // First instruction is setComputeUnitLimit
    const computeIx = tx.instructions[0];
    expect(computeIx.programId.equals(ComputeBudgetProgram.programId)).toBe(true);
  });

  it("sets compute budget to 400,000 CU with cNFT", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash,
      "https://example.com/metadata.json",
      "ab".repeat(32)
    );
    // 2 compute budget + 1 verify_photo + 1 mint_v1 = 4
    expect(tx.instructions).toHaveLength(4);
  });

  it("verify_photo instruction has correct accounts", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash
    );
    const verifyIx = tx.instructions[2]; // After 2 compute budget instructions
    expect(verifyIx.programId.equals(PROGRAM_ID)).toBe(true);

    // 3 accounts: photoRecordPDA, creator, systemProgram
    expect(verifyIx.keys).toHaveLength(3);

    // Account 0: photoRecordPDA (writable, not signer)
    const [expectedPDA] = getPhotoRecordPDA(creator, Buffer.from(imageHash));
    expect(verifyIx.keys[0].pubkey.equals(expectedPDA)).toBe(true);
    expect(verifyIx.keys[0].isWritable).toBe(true);
    expect(verifyIx.keys[0].isSigner).toBe(false);

    // Account 1: creator (writable, signer)
    expect(verifyIx.keys[1].pubkey.equals(creator)).toBe(true);
    expect(verifyIx.keys[1].isWritable).toBe(true);
    expect(verifyIx.keys[1].isSigner).toBe(true);

    // Account 2: System Program
    expect(verifyIx.keys[2].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(verifyIx.keys[2].isWritable).toBe(false);
    expect(verifyIx.keys[2].isSigner).toBe(false);
  });

  it("instruction data has correct length and layout", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash
    );
    const data = tx.instructions[2].data;

    // 8 (discriminator) + 32 (imageHash) + 8 (lat) + 8 (lng) + 8 (timestamp) = 64
    expect(data.length).toBe(64);

    // First 8 bytes: discriminator
    expect(Array.from(data.slice(0, 8))).toEqual(
      [0xa6, 0x53, 0x75, 0xc7, 0xc3, 0x30, 0xad, 0x44]
    );

    // Bytes 8–40: imageHash
    expect(Array.from(data.slice(8, 40))).toEqual(imageHash);
  });

  it("encodes GPS coordinates as fixed-point i64 (×1e7)", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash
    );
    const data = Buffer.from(tx.instructions[2].data);

    // latitude = 40.7128 → 407128000
    const latValue = Number(data.readBigInt64LE(40));
    expect(latValue).toBe(Math.round(40.7128 * 1e7));

    // longitude = -74.006 → -740060000 (signed i64)
    const lngValue = Number(data.readBigInt64LE(48));
    expect(lngValue).toBe(Math.round(-74.006 * 1e7));
  });

  it("encodes timestamp as i64 little-endian", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, latitude, longitude, timestamp, blockhash
    );
    const data = tx.instructions[2].data;

    const tsBuf = data.slice(56, 64);
    const tsValue = new BN(tsBuf, "le").toNumber();
    expect(tsValue).toBe(timestamp);
  });

  it("handles zero GPS coordinates", () => {
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, 0, 0, timestamp, blockhash
    );
    const data = tx.instructions[2].data;

    const latValue = new BN(data.slice(40, 48), "le").toNumber();
    const lngValue = new BN(data.slice(48, 56), "le").toNumber();
    expect(latValue).toBe(0);
    expect(lngValue).toBe(0);
  });

  it("handles extreme GPS values (poles, date line)", () => {
    // North Pole: 90°, South Pole: -90°, Date line: ±180°
    const tx = buildVerifyPhotoTransaction(
      creator, imageHash, 90, 180, timestamp, blockhash
    );
    const data = tx.instructions[2].data;

    const latValue = new BN(data.slice(40, 48), "le").toNumber();
    expect(latValue).toBe(900_000_000); // 90 × 1e7

    const lngValue = new BN(data.slice(48, 56), "le").toNumber();
    expect(lngValue).toBe(1_800_000_000); // 180 × 1e7
  });
});

// ─── buildVouchTransaction ──────────────────────────────────────────────────

describe("buildVouchTransaction", () => {
  const voucher = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
  const creator = new PublicKey("BZzUMvRYfQdMzqrxCqDDjW2CP6oKDUJY6uw5aNBxMo3f");
  const photoRecordPDA = new PublicKey("A5xLKVy5LdYhqDrXHSxpJ8xKVqM4MJXGBG5CGLU2UE9");
  const blockhash = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
  const amountLamports = 5_000_000; // 0.005 SOL

  it("builds a transaction with correct structure", () => {
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, amountLamports, blockhash
    );

    expect(tx.recentBlockhash).toBe(blockhash);
    expect(tx.feePayer!.equals(voucher)).toBe(true);
    // 2 compute budget + 1 vouch
    expect(tx.instructions).toHaveLength(3);
  });

  it("vouch instruction has correct accounts", () => {
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, amountLamports, blockhash
    );
    const vouchIx = tx.instructions[2];

    expect(vouchIx.programId.equals(PROGRAM_ID)).toBe(true);
    // 5 accounts: vouchRecordPDA, photoRecordPDA, voucher, creator, systemProgram
    expect(vouchIx.keys).toHaveLength(5);

    // Account 0: vouchRecordPDA (writable, not signer)
    const [expectedVouchPDA] = getVouchRecordPDA(voucher, photoRecordPDA);
    expect(vouchIx.keys[0].pubkey.equals(expectedVouchPDA)).toBe(true);
    expect(vouchIx.keys[0].isWritable).toBe(true);
    expect(vouchIx.keys[0].isSigner).toBe(false);

    // Account 1: photoRecordPDA (writable, not signer)
    expect(vouchIx.keys[1].pubkey.equals(photoRecordPDA)).toBe(true);
    expect(vouchIx.keys[1].isWritable).toBe(true);
    expect(vouchIx.keys[1].isSigner).toBe(false);

    // Account 2: voucher (writable, signer)
    expect(vouchIx.keys[2].pubkey.equals(voucher)).toBe(true);
    expect(vouchIx.keys[2].isWritable).toBe(true);
    expect(vouchIx.keys[2].isSigner).toBe(true);

    // Account 3: creator (writable, not signer — receives SOL)
    expect(vouchIx.keys[3].pubkey.equals(creator)).toBe(true);
    expect(vouchIx.keys[3].isWritable).toBe(true);
    expect(vouchIx.keys[3].isSigner).toBe(false);

    // Account 4: System Program
    expect(vouchIx.keys[4].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(vouchIx.keys[4].isWritable).toBe(false);
    expect(vouchIx.keys[4].isSigner).toBe(false);
  });

  it("instruction data has correct length and discriminator", () => {
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, amountLamports, blockhash
    );
    const data = tx.instructions[2].data;

    // 8 (discriminator) + 8 (amount) = 16
    expect(data.length).toBe(16);

    // Discriminator
    expect(Array.from(data.slice(0, 8))).toEqual(
      [0x57, 0xf0, 0x08, 0x15, 0xdb, 0xb3, 0xf2, 0xb1]
    );
  });

  it("encodes amount as u64 little-endian", () => {
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, amountLamports, blockhash
    );
    const data = tx.instructions[2].data;

    const amountBuf = data.slice(8, 16);
    const amount = new BN(amountBuf, "le").toNumber();
    expect(amount).toBe(amountLamports);
  });

  it("handles maximum vouch amount (5 SOL)", () => {
    const maxAmount = 5_000_000_000;
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, maxAmount, blockhash
    );
    const data = tx.instructions[2].data;

    const amount = new BN(data.slice(8, 16), "le").toNumber();
    expect(amount).toBe(maxAmount);
  });

  it("handles minimum vouch amount (1 lamport)", () => {
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, 1, blockhash
    );
    const data = tx.instructions[2].data;

    const amount = new BN(data.slice(8, 16), "le").toNumber();
    expect(amount).toBe(1);
  });

  it("correctly derives vouch PDA from voucher and photo record", () => {
    const tx = buildVouchTransaction(
      voucher, creator, photoRecordPDA, amountLamports, blockhash
    );
    const vouchIx = tx.instructions[2];
    const [expectedPDA] = getVouchRecordPDA(voucher, photoRecordPDA);
    expect(vouchIx.keys[0].pubkey.equals(expectedPDA)).toBe(true);
  });
});

// ─── Account ordering must match program's #[derive(Accounts)] ─────────────

describe("account ordering matches Anchor program", () => {
  it("verify_photo accounts: photoRecord, creator, systemProgram", () => {
    const creator = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
    const tx = buildVerifyPhotoTransaction(
      creator,
      Array.from(Buffer.alloc(32, 1)),
      0, 0, 1700000000,
      "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N"
    );
    const keys = tx.instructions[2].keys;

    // Anchor expects accounts in the order they appear in #[derive(Accounts)]
    expect(keys[0].isSigner).toBe(false); // photoRecord PDA
    expect(keys[1].isSigner).toBe(true);  // creator (signer)
    expect(keys[2].pubkey.equals(SystemProgram.programId)).toBe(true);
  });

  it("vouch accounts: vouchRecord, photoRecord, voucher, creator, systemProgram", () => {
    const voucher = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
    const creator = new PublicKey("BZzUMvRYfQdMzqrxCqDDjW2CP6oKDUJY6uw5aNBxMo3f");
    const photoRecord = new PublicKey("A5xLKVy5LdYhqDrXHSxpJ8xKVqM4MJXGBG5CGLU2UE9");
    const tx = buildVouchTransaction(voucher, creator, photoRecord, 1000, "x".repeat(44));
    const keys = tx.instructions[2].keys;

    expect(keys[0].isSigner).toBe(false); // vouchRecord PDA
    expect(keys[1].isSigner).toBe(false); // photoRecord PDA
    expect(keys[2].isSigner).toBe(true);  // voucher (signer)
    expect(keys[3].isSigner).toBe(false); // creator (not signer)
    expect(keys[4].pubkey.equals(SystemProgram.programId)).toBe(true);
  });
});
