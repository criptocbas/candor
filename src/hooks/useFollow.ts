import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, ensureUserExists } from "../services/supabase";

export function useFollowingList(walletAddress: string | null) {
  return useQuery({
    queryKey: ["follows", "following", walletAddress],
    queryFn: async (): Promise<Set<string>> => {
      if (!walletAddress) return new Set();
      const { data, error } = await supabase
        .from("follows")
        .select("following_wallet")
        .eq("follower_wallet", walletAddress);

      if (error) throw error;
      return new Set((data ?? []).map((f) => f.following_wallet));
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
  });
}

export function useFollowCounts(walletAddress: string | null) {
  return useQuery({
    queryKey: ["follows", "counts", walletAddress],
    queryFn: async (): Promise<{ followers: number; following: number }> => {
      if (!walletAddress) return { followers: 0, following: 0 };

      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_wallet", walletAddress),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_wallet", walletAddress),
      ]);

      if (followersRes.error) throw followersRes.error;
      if (followingRes.error) throw followingRes.error;

      return {
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
  });
}

export function useIsFollowing(
  myWallet: string | null,
  targetWallet: string | null
) {
  return useQuery({
    queryKey: ["follows", "check", myWallet, targetWallet],
    queryFn: async (): Promise<boolean> => {
      if (!myWallet || !targetWallet) return false;
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_wallet", myWallet)
        .eq("following_wallet", targetWallet)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!myWallet && !!targetWallet && myWallet !== targetWallet,
    staleTime: 30_000,
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);

  const toggleFollow = useCallback(
    async (
      myWallet: string,
      targetWallet: string,
      currentlyFollowing: boolean
    ) => {
      setIsToggling(true);
      try {
        if (currentlyFollowing) {
          const { error } = await supabase
            .from("follows")
            .delete()
            .eq("follower_wallet", myWallet)
            .eq("following_wallet", targetWallet);
          if (error) throw error;
        } else {
          // Ensure both user rows exist before inserting (so FK IDs get linked)
          await ensureUserExists(myWallet);
          await ensureUserExists(targetWallet);
          const { error } = await supabase.from("follows").insert({
            follower_wallet: myWallet,
            following_wallet: targetWallet,
          });
          if (error) throw error;
        }
        queryClient.invalidateQueries({ queryKey: ["follows"] });
      } catch (err: any) {
        console.error("Toggle follow failed:", err);
        Alert.alert("Error", err.message || "Failed to update follow status");
      } finally {
        setIsToggling(false);
      }
    },
    [queryClient]
  );

  return { toggleFollow, isToggling };
}
