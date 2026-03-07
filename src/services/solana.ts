import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

// Devnet for development
export const CLUSTER = "devnet" as const;
export const ENDPOINT = clusterApiUrl(CLUSTER);

// TODO: Replace with your deployed program ID from Solana Playground
export const PROGRAM_ID = new PublicKey(
  "HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw"
);

export function getConnection(): Connection {
  return new Connection(ENDPOINT, "confirmed");
}

export function getPhotoRecordPDA(
  creator: PublicKey,
  imageHash: Buffer
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("photo"), creator.toBuffer(), imageHash],
    PROGRAM_ID
  );
}

export function getVouchRecordPDA(
  voucher: PublicKey,
  photoRecord: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vouch"), voucher.toBuffer(), photoRecord.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * On-chain PhotoRecord data parsed from the PDA account.
 */
export interface OnChainPhotoRecord {
  creator: string;
  imageHash: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  vouchCount: number;
  totalEarned: number;
  bump: number;
  pdaAddress: string;
}

/**
 * Fetch and deserialize a PhotoRecord PDA directly from Solana.
 * This proves the on-chain data exists and matches what the app displays.
 */
export async function fetchPhotoRecordOnChain(
  connection: Connection,
  creatorWallet: string,
  imageHashHex: string
): Promise<OnChainPhotoRecord | null> {
  const creator = new PublicKey(creatorWallet);
  const imageHashBytes = Buffer.from(imageHashHex, "hex");
  const [pda] = getPhotoRecordPDA(creator, imageHashBytes);

  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo || !accountInfo.data) return null;

  const data = accountInfo.data;

  // Skip 8-byte Anchor discriminator
  const offset = 8;

  // creator: Pubkey (32 bytes)
  const creatorKey = new PublicKey(data.slice(offset, offset + 32));

  // imageHash: [u8; 32] (32 bytes)
  const hash = data.slice(offset + 32, offset + 64);
  const hashHex = Buffer.from(hash).toString("hex");

  // latitude: i64 (8 bytes, little-endian)
  const latRaw = data.readBigInt64LE(offset + 64);
  const latitude = Number(latRaw) / 1e7;

  // longitude: i64 (8 bytes, little-endian)
  const lngRaw = data.readBigInt64LE(offset + 72);
  const longitude = Number(lngRaw) / 1e7;

  // timestamp: i64 (8 bytes, little-endian)
  const tsRaw = data.readBigInt64LE(offset + 80);
  const timestamp = Number(tsRaw);

  // vouch_count: u64 (8 bytes, little-endian)
  const vcRaw = data.readBigUInt64LE(offset + 88);
  const vouchCount = Number(vcRaw);

  // total_earned: u64 (8 bytes, little-endian)
  const teRaw = data.readBigUInt64LE(offset + 96);
  const totalEarned = Number(teRaw);

  // bump: u8 (1 byte)
  const bump = data[offset + 104];

  return {
    creator: creatorKey.toBase58(),
    imageHash: hashHex,
    latitude,
    longitude,
    timestamp,
    vouchCount,
    totalEarned,
    bump,
    pdaAddress: pda.toBase58(),
  };
}

export function getExplorerUrl(
  signature: string,
  cluster: string = CLUSTER
): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function getExplorerAddressUrl(
  address: string,
  cluster: string = CLUSTER
): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}
