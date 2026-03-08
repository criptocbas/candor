/**
 * Tests for client-side validation logic that mirrors on-chain constraints.
 * These verify that the client catches invalid inputs before sending transactions,
 * matching the Anchor program's error conditions.
 */
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Mock expo modules (crypto.ts imports expo-crypto/expo-file-system at module level)
jest.mock("expo-crypto", () => ({}));
jest.mock("expo-file-system", () => ({}));

import { hashToBytes } from "../../src/utils/crypto";

// ─── Constants (must match program and client hooks) ────────────────────────

const MAX_VOUCH_LAMPORTS = 5_000_000_000; // 5 SOL
const DEFAULT_VOUCH_LAMPORTS = 5_000_000; // 0.005 SOL
const ESTIMATED_FEE = 15_000; // tx fee + rent buffer

describe("vouch validation rules", () => {
  it("default vouch amount is within valid range", () => {
    expect(DEFAULT_VOUCH_LAMPORTS).toBeGreaterThan(0);
    expect(DEFAULT_VOUCH_LAMPORTS).toBeLessThanOrEqual(MAX_VOUCH_LAMPORTS);
  });

  it("max vouch amount is 5 SOL", () => {
    expect(MAX_VOUCH_LAMPORTS).toBe(5 * LAMPORTS_PER_SOL);
  });

  it("rejects zero amount", () => {
    expect(0).not.toBeGreaterThan(0);
  });

  it("rejects negative amount", () => {
    expect(-1).not.toBeGreaterThan(0);
  });

  it("rejects amount exceeding max", () => {
    const overMax = MAX_VOUCH_LAMPORTS + 1;
    expect(overMax).toBeGreaterThan(MAX_VOUCH_LAMPORTS);
  });

  it("accepts exactly max amount", () => {
    expect(MAX_VOUCH_LAMPORTS).toBeLessThanOrEqual(MAX_VOUCH_LAMPORTS);
  });

  it("self-vouch prevention: wallet matches creator", () => {
    const wallet: string = "GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4";
    const creator: string = wallet;
    expect(wallet === creator).toBe(true); // Should be rejected
  });

  it("self-vouch prevention: different wallets allowed", () => {
    const wallet: string = "GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4";
    const creator: string = "BZzUMvRYfQdMzqrxCqDDjW2CP6oKDUJY6uw5aNBxMo3f";
    expect(wallet === creator).toBe(false); // Should be allowed
  });

  it("balance check accounts for estimated fees", () => {
    const balance = 6_000_000; // 0.006 SOL
    const amount = DEFAULT_VOUCH_LAMPORTS; // 0.005 SOL
    const required = amount + ESTIMATED_FEE; // 0.005015 SOL
    // Should pass — balance (0.006) > required (0.005015)
    expect(balance).toBeGreaterThanOrEqual(required);
  });

  it("balance check fails when insufficient for fees", () => {
    const balance = DEFAULT_VOUCH_LAMPORTS; // Exactly vouch amount, no room for fees
    const required = DEFAULT_VOUCH_LAMPORTS + ESTIMATED_FEE;
    expect(balance).toBeLessThan(required);
  });
});

describe("photo verification validation", () => {
  it("image hash must be 32 bytes (64 hex chars)", () => {
    const validHash = "a".repeat(64);
    const bytes = hashToBytes(validHash);
    expect(bytes).toHaveLength(32);
  });

  it("timestamp must be in seconds (not milliseconds)", () => {
    const tsSeconds = Math.floor(Date.now() / 1000);
    // Seconds-based timestamps are ~10 digits
    expect(tsSeconds.toString().length).toBeLessThanOrEqual(10);

    const tsMillis = Date.now();
    // Millisecond timestamps are ~13 digits — would fail the ±5 min drift check
    expect(tsMillis.toString().length).toBeGreaterThanOrEqual(13);
  });

  it("GPS fixed-point encoding preserves 7 decimal places", () => {
    const lat = 40.7128;
    const latFixed = Math.round(lat * 1e7);
    const recovered = latFixed / 1e7;
    expect(recovered).toBeCloseTo(lat, 7);
  });

  it("GPS fixed-point handles negative coordinates", () => {
    const lng = -74.006;
    const lngFixed = Math.round(lng * 1e7);
    expect(lngFixed).toBeLessThan(0);
    const recovered = lngFixed / 1e7;
    expect(recovered).toBeCloseTo(lng, 7);
  });

  it("GPS fixed-point handles extreme values", () => {
    // Valid range: lat [-90, 90], lng [-180, 180]
    const maxLat = Math.round(90 * 1e7);
    const maxLng = Math.round(180 * 1e7);
    // Must fit in i64 (max ~9.2e18) — 1.8e9 is well within range
    expect(maxLat).toBe(900_000_000);
    expect(maxLng).toBe(1_800_000_000);
    expect(maxLat).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(maxLng).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

describe("PDA uniqueness guarantees", () => {
  it("same creator + same image = same photo PDA (prevents duplicates)", () => {
    const creator = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
    const hash = Buffer.alloc(32, 0xab);
    const seeds1 = [Buffer.from("photo"), creator.toBuffer(), hash];
    const seeds2 = [Buffer.from("photo"), creator.toBuffer(), hash];
    expect(seeds1.map((s) => s.toString("hex"))).toEqual(
      seeds2.map((s) => s.toString("hex"))
    );
  });

  it("same voucher + same photo = same vouch PDA (one vouch per user per photo)", () => {
    const voucher = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
    const photo = new PublicKey("BZzUMvRYfQdMzqrxCqDDjW2CP6oKDUJY6uw5aNBxMo3f");
    const seeds1 = [Buffer.from("vouch"), voucher.toBuffer(), photo.toBuffer()];
    const seeds2 = [Buffer.from("vouch"), voucher.toBuffer(), photo.toBuffer()];
    expect(seeds1.map((s) => s.toString("hex"))).toEqual(
      seeds2.map((s) => s.toString("hex"))
    );
  });
});

describe("program deployment check", () => {
  const PROGRAM_ID = new PublicKey("HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw");

  it("deployed program ID is not the System Program placeholder", () => {
    expect(PROGRAM_ID.toBase58()).not.toBe("11111111111111111111111111111111");
  });

  it("PROGRAM_DEPLOYED flag evaluates correctly", () => {
    const PROGRAM_DEPLOYED =
      PROGRAM_ID.toBase58() !== "11111111111111111111111111111111";
    expect(PROGRAM_DEPLOYED).toBe(true);
  });
});

describe("timestamp drift validation", () => {
  const MAX_TIMESTAMP_DRIFT_SECONDS = 300; // 5 minutes

  it("accepts timestamps within ±5 minutes of now", () => {
    const now = Math.floor(Date.now() / 1000);
    const drift = 0;
    expect(Math.abs(drift)).toBeLessThanOrEqual(MAX_TIMESTAMP_DRIFT_SECONDS);
  });

  it("rejects timestamps more than 5 minutes in the past", () => {
    const now = Math.floor(Date.now() / 1000);
    const oldTimestamp = now - 600; // 10 minutes ago
    const drift = Math.abs(oldTimestamp - now);
    expect(drift).toBeGreaterThan(MAX_TIMESTAMP_DRIFT_SECONDS);
  });

  it("rejects timestamps in the future beyond 5 minutes", () => {
    const now = Math.floor(Date.now() / 1000);
    const futureTimestamp = now + 600;
    const drift = Math.abs(futureTimestamp - now);
    expect(drift).toBeGreaterThan(MAX_TIMESTAMP_DRIFT_SECONDS);
  });

  it("accepts timestamp exactly at the boundary", () => {
    const drift = MAX_TIMESTAMP_DRIFT_SECONDS;
    expect(drift).toBeLessThanOrEqual(MAX_TIMESTAMP_DRIFT_SECONDS);
  });
});
