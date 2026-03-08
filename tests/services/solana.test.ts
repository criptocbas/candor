import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  CLUSTER,
  getPhotoRecordPDA,
  getVouchRecordPDA,
  getExplorerUrl,
  getExplorerAddressUrl,
} from "../../src/services/solana";

describe("PROGRAM_ID", () => {
  it("is a valid PublicKey", () => {
    expect(PROGRAM_ID).toBeInstanceOf(PublicKey);
    expect(PROGRAM_ID.toBase58()).toBe(
      "HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw"
    );
  });

  it("is not the System Program placeholder", () => {
    expect(PROGRAM_ID.toBase58()).not.toBe(
      "11111111111111111111111111111111"
    );
  });
});

describe("CLUSTER", () => {
  it("is set to devnet", () => {
    expect(CLUSTER).toBe("devnet");
  });
});

describe("getPhotoRecordPDA", () => {
  const creator = new PublicKey(
    "GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4"
  );
  const imageHash = Buffer.alloc(32, 0xab);

  it("returns a PublicKey and bump seed", () => {
    const [pda, bump] = getPhotoRecordPDA(creator, imageHash);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(typeof bump).toBe("number");
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("is deterministic — same inputs produce same PDA", () => {
    const [pda1] = getPhotoRecordPDA(creator, imageHash);
    const [pda2] = getPhotoRecordPDA(creator, imageHash);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it("produces different PDAs for different creators", () => {
    const otherCreator = new PublicKey(
      "11111111111111111111111111111112"
    );
    const [pda1] = getPhotoRecordPDA(creator, imageHash);
    const [pda2] = getPhotoRecordPDA(otherCreator, imageHash);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it("produces different PDAs for different image hashes", () => {
    const otherHash = Buffer.alloc(32, 0xcd);
    const [pda1] = getPhotoRecordPDA(creator, imageHash);
    const [pda2] = getPhotoRecordPDA(creator, otherHash);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it("uses the correct seeds: [b'photo', creator, imageHash]", () => {
    // Manually derive to verify seeds match
    const [expectedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("photo"), creator.toBuffer(), imageHash],
      PROGRAM_ID
    );
    const [pda] = getPhotoRecordPDA(creator, imageHash);
    expect(pda.equals(expectedPda)).toBe(true);
  });

  it("is not on the ed25519 curve (valid PDA)", () => {
    const [pda] = getPhotoRecordPDA(creator, imageHash);
    // PDAs are off-curve by design
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false);
  });
});

describe("getVouchRecordPDA", () => {
  const voucher = new PublicKey(
    "GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4"
  );
  const photoRecord = new PublicKey(
    "BZzUMvRYfQdMzqrxCqDDjW2CP6oKDUJY6uw5aNBxMo3f"
  );

  it("returns a PublicKey and bump seed", () => {
    const [pda, bump] = getVouchRecordPDA(voucher, photoRecord);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(typeof bump).toBe("number");
  });

  it("is deterministic", () => {
    const [pda1] = getVouchRecordPDA(voucher, photoRecord);
    const [pda2] = getVouchRecordPDA(voucher, photoRecord);
    expect(pda1.equals(pda2)).toBe(true);
  });

  it("uses the correct seeds: [b'vouch', voucher, photoRecord]", () => {
    const [expectedPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouch"),
        voucher.toBuffer(),
        photoRecord.toBuffer(),
      ],
      PROGRAM_ID
    );
    const [pda] = getVouchRecordPDA(voucher, photoRecord);
    expect(pda.equals(expectedPda)).toBe(true);
  });

  it("enforces one vouch per user per photo — different voucher = different PDA", () => {
    const otherVoucher = new PublicKey(
      "11111111111111111111111111111112"
    );
    const [pda1] = getVouchRecordPDA(voucher, photoRecord);
    const [pda2] = getVouchRecordPDA(otherVoucher, photoRecord);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it("different photo = different PDA for same voucher", () => {
    const otherPhoto = new PublicKey(
      "11111111111111111111111111111112"
    );
    const [pda1] = getVouchRecordPDA(voucher, photoRecord);
    const [pda2] = getVouchRecordPDA(voucher, otherPhoto);
    expect(pda1.equals(pda2)).toBe(false);
  });
});

describe("Explorer URL helpers", () => {
  it("generates transaction explorer URL", () => {
    const sig = "5abc123";
    expect(getExplorerUrl(sig)).toBe(
      "https://explorer.solana.com/tx/5abc123?cluster=devnet"
    );
  });

  it("generates transaction URL with custom cluster", () => {
    expect(getExplorerUrl("sig123", "mainnet-beta")).toBe(
      "https://explorer.solana.com/tx/sig123?cluster=mainnet-beta"
    );
  });

  it("generates address explorer URL", () => {
    const addr = "HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw";
    expect(getExplorerAddressUrl(addr)).toBe(
      `https://explorer.solana.com/address/${addr}?cluster=devnet`
    );
  });
});
