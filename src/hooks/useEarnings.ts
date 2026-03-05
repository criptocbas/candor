import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

interface EarningsData {
  totalEarnedLamports: number;
  totalVouches: number;
  photoCount: number;
}

export function useEarnings(walletAddress: string | null) {
  return useQuery({
    queryKey: ["earnings", walletAddress],
    queryFn: async (): Promise<EarningsData> => {
      if (!walletAddress) {
        return { totalEarnedLamports: 0, totalVouches: 0, photoCount: 0 };
      }

      const { data, error } = await supabase
        .from("photos")
        .select("total_earned_lamports, vouch_count")
        .eq("creator_wallet", walletAddress);

      if (error) throw error;

      const photos = data ?? [];
      return {
        totalEarnedLamports: photos.reduce(
          (sum, p) => sum + (p.total_earned_lamports || 0),
          0
        ),
        totalVouches: photos.reduce(
          (sum, p) => sum + (p.vouch_count || 0),
          0
        ),
        photoCount: photos.length,
      };
    },
    enabled: !!walletAddress,
    staleTime: 15_000, // 15 seconds
  });
}

export interface TopCreator {
  wallet_address: string;
  display_name: string;
  avatar_url: string | null;
  total_earned: number;
  vouch_count: number;
  photo_count: number;
}

export function useTopCreators(limit = 10) {
  return useQuery({
    queryKey: ["leaderboard", "top-creators", limit],
    queryFn: async (): Promise<TopCreator[]> => {
      // Fetch all photos with creator join, then aggregate client-side
      const { data, error } = await supabase
        .from("photos")
        .select("creator_wallet, total_earned_lamports, vouch_count, creator:users!creator_id(wallet_address, display_name, avatar_url)")
        .gt("total_earned_lamports", 0);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Aggregate by creator
      const creatorMap = new Map<string, TopCreator>();
      for (const photo of data) {
        const wallet = photo.creator_wallet;
        const existing = creatorMap.get(wallet);
        const creator = photo.creator as any;
        if (existing) {
          existing.total_earned += photo.total_earned_lamports || 0;
          existing.vouch_count += photo.vouch_count || 0;
          existing.photo_count += 1;
        } else {
          creatorMap.set(wallet, {
            wallet_address: wallet,
            display_name: creator?.display_name || wallet.slice(0, 4) + "..." + wallet.slice(-4),
            avatar_url: creator?.avatar_url || null,
            total_earned: photo.total_earned_lamports || 0,
            vouch_count: photo.vouch_count || 0,
            photo_count: 1,
          });
        }
      }

      return Array.from(creatorMap.values())
        .sort((a, b) => b.total_earned - a.total_earned)
        .slice(0, limit);
    },
    staleTime: 30_000,
  });
}

export function useSolPrice() {
  return useQuery({
    queryKey: ["sol-price"],
    queryFn: async (): Promise<number> => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await response.json();
        return data.solana?.usd ?? 0;
      } catch {
        return 0;
      }
    },
    staleTime: 60_000, // 1 minute
  });
}
