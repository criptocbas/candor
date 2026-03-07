import { PublicKey } from "@solana/web3.js";

export interface User {
  id: string;
  wallet_address: string;
  display_name: string;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  last_verified_date: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  creator_id: string;
  creator_wallet: string;
  image_url: string;
  image_hash: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  verification_tx: string | null;
  vouch_count: number;
  total_earned_lamports: number;
  created_at: string;
  // Joined from users table
  creator?: User;
}

export interface Vouch {
  id: string;
  photo_id: string;
  voucher_id: string;
  voucher_wallet: string;
  amount_lamports: number;
  tx_signature: string;
  created_at: string;
  // Joined
  voucher?: User;
}

export interface Follow {
  id: string;
  follower_id: string;
  follower_wallet: string;
  following_id: string;
  following_wallet: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_wallet: string;
  actor_wallet: string;
  type: "vouch" | "follow";
  photo_id: string | null;
  amount_lamports: number | null;
  read: boolean;
  created_at: string;
  // Joined
  actor?: User;
}

export interface WalletState {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
}

export interface VerificationResult {
  imageHash: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  txSignature: string;
  timestamp: number;
}

export interface PhotoUploadData {
  imageUri: string;
  imageHash: string;
  caption: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  verificationTx: string;
  creatorWallet: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  PhotoDetail: { photoId: string };
  UserProfile: { walletAddress: string };
  UserSearch: undefined;
};

export type TabParamList = {
  Camera: undefined;
  Feed: undefined;
  Notifications: undefined;
  Profile: undefined;
};

// Anchor program types
export interface PhotoRecordAccount {
  creator: PublicKey;
  imageHash: number[];
  latitude: number;
  longitude: number;
  timestamp: number;
  vouchCount: number;
  totalEarned: number;
  bump: number;
}

export interface VouchRecordAccount {
  voucher: PublicKey;
  photoRecord: PublicKey;
  amount: number;
  timestamp: number;
  bump: number;
}
