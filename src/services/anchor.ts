import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { PROGRAM_ID, getPhotoRecordPDA, getVouchRecordPDA } from "./solana";

// Minimal IDL for the Candor program
// This should match the deployed program from Solana Playground
export const CANDOR_IDL: Idl = {
  version: "0.1.0",
  name: "candor_program",
  instructions: [
    {
      name: "verifyPhoto",
      accounts: [
        { name: "photoRecord", isMut: true, isSigner: false },
        { name: "creator", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "imageHash", type: { array: ["u8", 32] } },
        { name: "latitude", type: "i64" },
        { name: "longitude", type: "i64" },
        { name: "timestamp", type: "i64" },
      ],
    },
    {
      name: "vouch",
      accounts: [
        { name: "vouchRecord", isMut: true, isSigner: false },
        { name: "photoRecord", isMut: true, isSigner: false },
        { name: "voucher", isMut: true, isSigner: true },
        { name: "creator", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
  ],
  accounts: [
    {
      name: "PhotoRecord",
      type: {
        kind: "struct",
        fields: [
          { name: "creator", type: "publicKey" },
          { name: "imageHash", type: { array: ["u8", 32] } },
          { name: "latitude", type: "i64" },
          { name: "longitude", type: "i64" },
          { name: "timestamp", type: "i64" },
          { name: "vouchCount", type: "u64" },
          { name: "totalEarned", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "VouchRecord",
      type: {
        kind: "struct",
        fields: [
          { name: "voucher", type: "publicKey" },
          { name: "photoRecord", type: "publicKey" },
          { name: "amount", type: "u64" },
          { name: "timestamp", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
};

/**
 * Build a verify_photo transaction (unsigned — MWA will sign it)
 */
export function buildVerifyPhotoTransaction(
  creator: PublicKey,
  imageHash: number[],
  latitude: number,
  longitude: number,
  timestamp: number,
  recentBlockhash: string
): Transaction {
  const [photoRecordPDA] = getPhotoRecordPDA(
    creator,
    Buffer.from(imageHash)
  );

  // Convert GPS coords to fixed-point i64 (multiply by 1e7)
  const latFixed = new BN(Math.round(latitude * 1e7));
  const lngFixed = new BN(Math.round(longitude * 1e7));
  const ts = new BN(timestamp);

  const tx = new Transaction();
  tx.recentBlockhash = recentBlockhash;
  tx.feePayer = creator;

  // Set compute budget for mainnet reliability
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }));

  // Build the instruction data manually for Anchor
  // Discriminator (8 bytes) + imageHash (32 bytes) + lat (8) + lng (8) + timestamp (8)
  const discriminator = Buffer.from(
    // SHA-256("global:verify_photo")[0..8]
    [0xa6, 0x53, 0x75, 0xc7, 0xc3, 0x30, 0xad, 0x44]
  );

  const data = Buffer.alloc(8 + 32 + 8 + 8 + 8);
  discriminator.copy(data, 0);
  Buffer.from(imageHash).copy(data, 8);
  latFixed.toArrayLike(Buffer, "le", 8).copy(data, 40);
  lngFixed.toArrayLike(Buffer, "le", 8).copy(data, 48);
  ts.toArrayLike(Buffer, "le", 8).copy(data, 56);

  tx.add({
    keys: [
      { pubkey: photoRecordPDA, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  return tx;
}

/**
 * Build a vouch transaction (unsigned — MWA will sign it)
 */
export function buildVouchTransaction(
  voucher: PublicKey,
  creator: PublicKey,
  photoRecordPDA: PublicKey,
  amountLamports: number,
  recentBlockhash: string
): Transaction {
  const [vouchRecordPDA] = getVouchRecordPDA(voucher, photoRecordPDA);
  const amount = new BN(amountLamports.toString());

  const tx = new Transaction();
  tx.recentBlockhash = recentBlockhash;
  tx.feePayer = voucher;

  // Set compute budget for mainnet reliability
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }));

  // Build the instruction data manually for Anchor
  // Discriminator (8 bytes) + amount (8 bytes)
  const discriminator = Buffer.from(
    // SHA-256("global:vouch")[0..8]
    [0x57, 0xf0, 0x08, 0x15, 0xdb, 0xb3, 0xf2, 0xb1]
  );

  const data = Buffer.alloc(8 + 8);
  discriminator.copy(data, 0);
  amount.toArrayLike(Buffer, "le", 8).copy(data, 8);

  tx.add({
    keys: [
      { pubkey: vouchRecordPDA, isSigner: false, isWritable: true },
      { pubkey: photoRecordPDA, isSigner: false, isWritable: true },
      { pubkey: voucher, isSigner: true, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  return tx;
}
