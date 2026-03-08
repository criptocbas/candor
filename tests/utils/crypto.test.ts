// Mock expo modules (hashImageFile depends on expo-crypto/expo-file-system,
// but we only test hashToBytes which is pure computation)
jest.mock("expo-crypto", () => ({}));
jest.mock("expo-file-system", () => ({}));

import { hashToBytes } from "../../src/utils/crypto";

describe("hashToBytes", () => {
  it("converts a 64-char hex string to 32 bytes", () => {
    const hex = "a".repeat(64); // all 0xAA bytes
    const bytes = hashToBytes(hex);
    expect(bytes).toHaveLength(32);
    expect(bytes.every((b) => b === 0xaa)).toBe(true);
  });

  it("converts a real SHA-256 hash", () => {
    // SHA-256 of "hello"
    const hash =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    const bytes = hashToBytes(hash);
    expect(bytes).toHaveLength(32);
    expect(bytes[0]).toBe(0x2c);
    expect(bytes[1]).toBe(0xf2);
    expect(bytes[31]).toBe(0x24);
  });

  it("handles all-zero hash", () => {
    const bytes = hashToBytes("0".repeat(64));
    expect(bytes).toHaveLength(32);
    expect(bytes.every((b) => b === 0)).toBe(true);
  });

  it("handles all-ff hash", () => {
    const bytes = hashToBytes("f".repeat(64));
    expect(bytes).toHaveLength(32);
    expect(bytes.every((b) => b === 0xff)).toBe(true);
  });

  it("handles mixed case hex", () => {
    const lower = hashToBytes("aabbccdd" + "0".repeat(56));
    const upper = hashToBytes("AABBCCDD" + "0".repeat(56));
    expect(lower[0]).toBe(0xaa);
    expect(upper[0]).toBe(0xaa);
    expect(lower).toEqual(upper);
  });

  it("produces correct bytes for on-chain imageHash encoding", () => {
    // Verify that the output is suitable for Anchor's [u8; 32] argument
    const hash =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const bytes = hashToBytes(hash);
    expect(bytes).toHaveLength(32);
    // Should be usable as Buffer for PDA seeds
    const buf = Buffer.from(bytes);
    expect(buf.length).toBe(32);
  });
});
