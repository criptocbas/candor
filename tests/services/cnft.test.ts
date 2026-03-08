import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";

// Mock supabase before importing cnft (cnft.ts imports supabase at module level)
jest.mock("../../src/services/supabase", () => ({
  supabase: {},
  PHOTOS_BUCKET: "photos",
}));

import {
  BUBBLEGUM_PROGRAM_ID,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  MERKLE_TREE_ADDRESS,
  getTreeAuthorityPDA,
  buildMintCnftInstruction,
} from "../../src/services/cnft";

// ─── Program ID Constants ───────────────────────────────────────────────────

describe("cNFT program constants", () => {
  it("Bubblegum program ID is correct", () => {
    expect(BUBBLEGUM_PROGRAM_ID.toBase58()).toBe(
      "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
    );
  });

  it("SPL Account Compression program ID is correct", () => {
    expect(SPL_ACCOUNT_COMPRESSION_PROGRAM_ID.toBase58()).toBe(
      "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
    );
  });

  it("SPL Noop program ID is correct (devnet variant)", () => {
    expect(SPL_NOOP_PROGRAM_ID.toBase58()).toBe(
      "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
    );
  });

  it("Merkle tree address is valid", () => {
    expect(MERKLE_TREE_ADDRESS).toBeInstanceOf(PublicKey);
    expect(MERKLE_TREE_ADDRESS.toBase58()).toBe(
      "F2xrhrR3TVCFQy7mHhAqM8HLYZ6EBaSjUPdEk9B6WrLN"
    );
  });
});

// ─── Tree Authority PDA ─────────────────────────────────────────────────────

describe("getTreeAuthorityPDA", () => {
  it("derives PDA from merkle tree address", () => {
    const [authority, bump] = getTreeAuthorityPDA(MERKLE_TREE_ADDRESS);
    expect(authority).toBeInstanceOf(PublicKey);
    expect(typeof bump).toBe("number");
    expect(PublicKey.isOnCurve(authority.toBuffer())).toBe(false);
  });

  it("uses correct seeds: [merkle_tree.toBuffer()]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [MERKLE_TREE_ADDRESS.toBuffer()],
      BUBBLEGUM_PROGRAM_ID
    );
    const [authority] = getTreeAuthorityPDA(MERKLE_TREE_ADDRESS);
    expect(authority.equals(expected)).toBe(true);
  });

  it("is deterministic", () => {
    const [a1] = getTreeAuthorityPDA(MERKLE_TREE_ADDRESS);
    const [a2] = getTreeAuthorityPDA(MERKLE_TREE_ADDRESS);
    expect(a1.equals(a2)).toBe(true);
  });
});

// ─── mint_v1 Discriminator ──────────────────────────────────────────────────

describe("mint_v1 discriminator", () => {
  it("matches SHA-256('global:mint_v1')[0..8]", () => {
    const hash = createHash("sha256").update("global:mint_v1").digest();
    const expected = Array.from(hash.slice(0, 8));
    // Known correct value
    expect(expected).toEqual([145, 98, 192, 118, 184, 147, 118, 104]);
  });
});

// ─── buildMintCnftInstruction ───────────────────────────────────────────────

describe("buildMintCnftInstruction", () => {
  const creator = new PublicKey("GVkrCG9PxEwagDXqzbyUtJgiAJhPFy7qYs3KdGrUbWH4");
  const metadataUri = "https://example.com/nft-metadata/abcdef01.json";
  const imageHash = "abcdef0123456789".repeat(4); // 64 char hex

  it("returns a valid TransactionInstruction", () => {
    const ix = buildMintCnftInstruction(creator, metadataUri, imageHash);
    expect(ix.programId.equals(BUBBLEGUM_PROGRAM_ID)).toBe(true);
    expect(ix.keys).toBeDefined();
    expect(ix.data).toBeDefined();
  });

  it("has exactly 9 accounts in correct order", () => {
    const ix = buildMintCnftInstruction(creator, metadataUri, imageHash);
    expect(ix.keys).toHaveLength(9);

    const [treeAuthority] = getTreeAuthorityPDA(MERKLE_TREE_ADDRESS);

    // 0: tree_config (tree authority PDA)
    expect(ix.keys[0].pubkey.equals(treeAuthority)).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);

    // 1: leaf_owner (creator)
    expect(ix.keys[1].pubkey.equals(creator)).toBe(true);
    expect(ix.keys[1].isWritable).toBe(false);
    expect(ix.keys[1].isSigner).toBe(false);

    // 2: leaf_delegate (creator)
    expect(ix.keys[2].pubkey.equals(creator)).toBe(true);
    expect(ix.keys[2].isWritable).toBe(false);
    expect(ix.keys[2].isSigner).toBe(false);

    // 3: merkle_tree
    expect(ix.keys[3].pubkey.equals(MERKLE_TREE_ADDRESS)).toBe(true);
    expect(ix.keys[3].isWritable).toBe(true);
    expect(ix.keys[3].isSigner).toBe(false);

    // 4: payer (creator, signer, writable)
    expect(ix.keys[4].pubkey.equals(creator)).toBe(true);
    expect(ix.keys[4].isWritable).toBe(true);
    expect(ix.keys[4].isSigner).toBe(true);

    // 5: tree_creator_or_delegate (creator, signer for public tree)
    expect(ix.keys[5].pubkey.equals(creator)).toBe(true);
    expect(ix.keys[5].isSigner).toBe(true);

    // 6: SPL Noop
    expect(ix.keys[6].pubkey.equals(SPL_NOOP_PROGRAM_ID)).toBe(true);

    // 7: SPL Account Compression
    expect(ix.keys[7].pubkey.equals(SPL_ACCOUNT_COMPRESSION_PROGRAM_ID)).toBe(true);

    // 8: System Program
    expect(ix.keys[8].pubkey.equals(SystemProgram.programId)).toBe(true);
  });

  it("instruction data starts with mint_v1 discriminator", () => {
    const ix = buildMintCnftInstruction(creator, metadataUri, imageHash);
    const discriminator = Array.from(ix.data.slice(0, 8));
    expect(discriminator).toEqual([145, 98, 192, 118, 184, 147, 118, 104]);
  });

  it("instruction data contains Borsh-serialized MetadataArgs", () => {
    const ix = buildMintCnftInstruction(creator, metadataUri, imageHash);
    const data = ix.data;

    // After 8-byte discriminator, we have Borsh-encoded MetadataArgs
    let offset = 8;

    // name: String (4-byte length prefix + UTF-8 bytes)
    const expectedName = `Candor #${imageHash.slice(0, 8)}`;
    const nameLen = data.readUInt32LE(offset);
    expect(nameLen).toBe(expectedName.length);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString("utf-8");
    expect(name).toBe(expectedName);
    offset += nameLen;

    // symbol: String
    const symbolLen = data.readUInt32LE(offset);
    expect(symbolLen).toBe(6); // "CANDOR"
    offset += 4;
    const symbol = data.slice(offset, offset + symbolLen).toString("utf-8");
    expect(symbol).toBe("CANDOR");
    offset += symbolLen;

    // uri: String
    const uriLen = data.readUInt32LE(offset);
    expect(uriLen).toBe(metadataUri.length);
    offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString("utf-8");
    expect(uri).toBe(metadataUri);
    offset += uriLen;

    // seller_fee_basis_points: u16
    const sellerFee = data.readUInt16LE(offset);
    expect(sellerFee).toBe(0);
    offset += 2;

    // primary_sale_happened: bool
    expect(data[offset]).toBe(0); // false
    offset += 1;

    // is_mutable: bool
    expect(data[offset]).toBe(0); // false (immutable)
    offset += 1;

    // edition_nonce: Option<u8> — None
    expect(data[offset]).toBe(0); // None discriminant
    offset += 1;

    // token_standard: Option<TokenStandard> — None
    expect(data[offset]).toBe(0);
    offset += 1;

    // collection: Option<Collection> — None
    expect(data[offset]).toBe(0);
    offset += 1;

    // uses: Option<Uses> — None
    expect(data[offset]).toBe(0);
    offset += 1;

    // token_program_version: TokenProgramVersion — Original (0)
    expect(data[offset]).toBe(0);
    offset += 1;

    // creators: Vec<Creator> — 1 creator
    const creatorsLen = data.readUInt32LE(offset);
    expect(creatorsLen).toBe(1);
    offset += 4;

    // Creator: address (32) + verified (1) + share (1)
    const creatorAddress = new PublicKey(data.slice(offset, offset + 32));
    expect(creatorAddress.equals(creator)).toBe(true);
    offset += 32;

    const verified = data[offset];
    expect(verified).toBe(0); // false — avoids signer verification issues
    offset += 1;

    const share = data[offset];
    expect(share).toBe(100); // 100% royalty share
    offset += 1;

    // We should have consumed all the data
    expect(offset).toBe(data.length);
  });

  it("uses different names for different image hashes", () => {
    const ix1 = buildMintCnftInstruction(creator, metadataUri, "aaaa" + "0".repeat(60));
    const ix2 = buildMintCnftInstruction(creator, metadataUri, "bbbb" + "0".repeat(60));
    // Names should differ because they include the first 8 chars of imageHash
    const name1Len = ix1.data.readUInt32LE(8);
    const name1 = ix1.data.slice(12, 12 + name1Len).toString("utf-8");
    const name2Len = ix2.data.readUInt32LE(8);
    const name2 = ix2.data.slice(12, 12 + name2Len).toString("utf-8");
    expect(name1).toBe("Candor #aaaa0000");
    expect(name2).toBe("Candor #bbbb0000");
  });
});
