import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// TODO: Replace with your Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ypiquahoisoorzzcdhzh.supabase.co";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwaXF1YWhvaXNvb3J6emNkaHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3Mzg3NzQsImV4cCI6MjA4ODMxNDc3NH0.8QYesf_67_4h3Kw6BKcGSA7_Yfszij02EXn0IPhjdp4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const PHOTOS_BUCKET = "photos";
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Ensure a user row exists for the given wallet address.
 * Uses upsert with onConflict so it's safe to call multiple times.
 */
export async function ensureUserExists(walletAddress: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .upsert(
      { wallet_address: walletAddress, display_name: "Anon" },
      { onConflict: "wallet_address", ignoreDuplicates: true }
    );
  if (error) {
    console.error("ensureUserExists failed:", error);
  }
}
