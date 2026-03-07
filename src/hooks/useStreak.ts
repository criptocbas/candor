import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastVerifiedDate: string | null;
  verifiedToday: boolean;
}

export function useStreak(walletAddress: string | null) {
  return useQuery({
    queryKey: ["streak", walletAddress],
    queryFn: async (): Promise<StreakData> => {
      if (!walletAddress) {
        return { currentStreak: 0, longestStreak: 0, lastVerifiedDate: null, verifiedToday: false };
      }

      const { data, error } = await supabase
        .from("users")
        .select("current_streak, longest_streak, last_verified_date")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return { currentStreak: 0, longestStreak: 0, lastVerifiedDate: null, verifiedToday: false };
      }

      const today = new Date().toISOString().split("T")[0];
      const verifiedToday = data.last_verified_date === today;

      return {
        currentStreak: data.current_streak ?? 0,
        longestStreak: data.longest_streak ?? 0,
        lastVerifiedDate: data.last_verified_date,
        verifiedToday,
      };
    },
    enabled: !!walletAddress,
    staleTime: 15_000,
  });
}
