import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { supabase, PHOTOS_BUCKET } from "./supabase";

// ─── Program IDs (deployed by Metaplex, same across all clusters) ────────────

export const BUBBLEGUM_PROGRAM_ID = new PublicKey(
  "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
);

export const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
);

export const SPL_NOOP_PROGRAM_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

// ─── Candor Merkle Tree (created on devnet, capacity: 16,384 cNFTs) ─────────

export const MERKLE_TREE_ADDRESS = new PublicKey(
  "F2xrhrR3TVCFQy7mHhAqM8HLYZ6EBaSjUPdEk9B6WrLN"
);

// ─── Bubblegum mint_v1 discriminator: SHA-256("global:mint_v1")[0..8] ────────

const MINT_V1_DISCRIMINATOR = Buffer.from([145, 98, 192, 118, 184, 147, 118, 104]);

// ─── Tree authority PDA ──────────────────────────────────────────────────────

export function getTreeAuthorityPDA(merkleTree: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [merkleTree.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  );
}

// ─── Borsh Serialization ─────────────────────────────────────────────────────

function borshString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function borshU16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function borshBool(value: boolean): Buffer {
  return Buffer.from([value ? 1 : 0]);
}

function borshNone(): Buffer {
  return Buffer.from([0]);
}

function borshEnum(variant: number): Buffer {
  return Buffer.from([variant]);
}

/**
 * Borsh-serialize MetadataArgs for Bubblegum mint_v1.
 *
 * MetadataArgs layout:
 *   name: String, symbol: String, uri: String,
 *   seller_fee_basis_points: u16, primary_sale_happened: bool,
 *   is_mutable: bool, edition_nonce: Option<u8>,
 *   token_standard: Option<TokenStandard>, collection: Option<Collection>,
 *   uses: Option<Uses>, token_program_version: TokenProgramVersion,
 *   creators: Vec<Creator>
 */
function serializeMetadataArgs(args: {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: { address: PublicKey; verified: boolean; share: number }[];
}): Buffer {
  const parts: Buffer[] = [];

  // Strings
  parts.push(borshString(args.name));
  parts.push(borshString(args.symbol));
  parts.push(borshString(args.uri));

  // seller_fee_basis_points: u16
  parts.push(borshU16(args.sellerFeeBasisPoints));

  // primary_sale_happened: bool
  parts.push(borshBool(false));

  // is_mutable: bool (immutable — verified photo should never change)
  parts.push(borshBool(false));

  // edition_nonce: Option<u8> — None
  parts.push(borshNone());

  // token_standard: Option<TokenStandard> — None
  parts.push(borshNone());

  // collection: Option<Collection> — None (no collection for now)
  parts.push(borshNone());

  // uses: Option<Uses> — None
  parts.push(borshNone());

  // token_program_version: TokenProgramVersion — Original (0)
  parts.push(borshEnum(0));

  // creators: Vec<Creator>
  const creatorsLen = Buffer.alloc(4);
  creatorsLen.writeUInt32LE(args.creators.length, 0);
  parts.push(creatorsLen);
  for (const creator of args.creators) {
    parts.push(Buffer.from(creator.address.toBuffer()));
    parts.push(borshBool(creator.verified));
    parts.push(Buffer.from([creator.share]));
  }

  return Buffer.concat(parts);
}

// ─── Build mint_v1 Instruction ───────────────────────────────────────────────

/**
 * Build a Bubblegum mint_v1 TransactionInstruction.
 * This mints the verified photo as a compressed NFT owned by the creator.
 */
export function buildMintCnftInstruction(
  creator: PublicKey,
  metadataUri: string,
  imageHash: string
): TransactionInstruction {
  const [treeAuthority] = getTreeAuthorityPDA(MERKLE_TREE_ADDRESS);

  const metadata = serializeMetadataArgs({
    name: `Candor #${imageHash.slice(0, 8)}`,
    symbol: "CANDOR",
    uri: metadataUri,
    sellerFeeBasisPoints: 0,
    creators: [{ address: creator, verified: false, share: 100 }],
  });

  const data = Buffer.concat([MINT_V1_DISCRIMINATOR, metadata]);

  return new TransactionInstruction({
    keys: [
      { pubkey: treeAuthority, isSigner: false, isWritable: true },     // tree_config
      { pubkey: creator, isSigner: false, isWritable: false },          // leaf_owner
      { pubkey: creator, isSigner: false, isWritable: false },          // leaf_delegate
      { pubkey: MERKLE_TREE_ADDRESS, isSigner: false, isWritable: true }, // merkle_tree
      { pubkey: creator, isSigner: true, isWritable: true },            // payer
      { pubkey: creator, isSigner: true, isWritable: false },           // tree_creator_or_delegate
      { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: BUBBLEGUM_PROGRAM_ID,
    data,
  });
}

// ─── Metadata Upload ─────────────────────────────────────────────────────────

/**
 * Upload NFT metadata JSON to Supabase Storage.
 * Returns the public URL for the metadata file (used as the cNFT uri).
 */
export async function uploadNftMetadata(args: {
  imageUrl: string;
  imageHash: string;
  caption: string | null;
  creatorWallet: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: number;
}): Promise<string> {
  const metadata = {
    name: `Candor #${args.imageHash.slice(0, 8)}`,
    symbol: "CANDOR",
    description:
      args.caption ||
      "Verified photo captured and cryptographically proven on Solana via Candor",
    image: args.imageUrl,
    external_url: "https://candor.app",
    attributes: [
      { trait_type: "Image Hash", value: args.imageHash },
      {
        trait_type: "Verified At",
        value: new Date(args.timestamp * 1000).toISOString(),
      },
      ...(args.latitude != null
        ? [{ trait_type: "Latitude", value: String(args.latitude) }]
        : []),
      ...(args.longitude != null
        ? [{ trait_type: "Longitude", value: String(args.longitude) }]
        : []),
    ],
    properties: {
      category: "image",
      files: [{ uri: args.imageUrl, type: "image/jpeg" }],
      creators: [{ address: args.creatorWallet, share: 100 }],
    },
  };

  const jsonString = JSON.stringify(metadata);
  const path = `nft-metadata/${args.imageHash.slice(0, 16)}.json`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, Buffer.from(jsonString, "utf-8"), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw new Error(`Metadata upload failed: ${error.message}`);

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
