import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { Photo, User, Vouch } from "../types";

export function useFeedPhotos() {
  return useQuery({
    queryKey: ["photos", "feed"],
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await supabase
        .from("photos")
        .select(
          `
          *,
          creator:users!creator_id(*)
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useUserPhotos(walletAddress: string | null) {
  return useQuery({
    queryKey: ["photos", "user", walletAddress],
    queryFn: async (): Promise<Photo[]> => {
      if (!walletAddress) return [];
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("creator_wallet", walletAddress)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress,
  });
}

export function usePhotoDetail(photoId: string) {
  return useQuery({
    queryKey: ["photos", "detail", photoId],
    queryFn: async (): Promise<Photo | null> => {
      const { data, error } = await supabase
        .from("photos")
        .select(
          `
          *,
          creator:users!creator_id(*)
        `
        )
        .eq("id", photoId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!photoId,
  });
}

export function usePhotoVouches(photoId: string) {
  return useQuery({
    queryKey: ["vouches", photoId],
    queryFn: async (): Promise<Vouch[]> => {
      const { data, error } = await supabase
        .from("vouches")
        .select(
          `
          *,
          voucher:users!voucher_id(*)
        `
        )
        .eq("photo_id", photoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!photoId,
  });
}

export function useUserInfo(walletAddress: string | null) {
  return useQuery({
    queryKey: ["user-info", walletAddress],
    queryFn: async (): Promise<User | null> => {
      if (!walletAddress) return null;
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!walletAddress,
  });
}

export function useUserVouchedPhotoIds(walletAddress: string | null) {
  return useQuery({
    queryKey: ["vouches", "user", walletAddress],
    queryFn: async (): Promise<Set<string>> => {
      if (!walletAddress) return new Set();
      const { data, error } = await supabase
        .from("vouches")
        .select("photo_id")
        .eq("voucher_wallet", walletAddress);

      if (error) throw error;
      return new Set((data ?? []).map((v) => v.photo_id));
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
  });
}

export function useFollowingFeedPhotos(walletAddress: string | null) {
  return useQuery({
    queryKey: ["photos", "following", walletAddress],
    queryFn: async (): Promise<Photo[]> => {
      if (!walletAddress) return [];

      // Step 1: fetch followed wallets
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("following_wallet")
        .eq("follower_wallet", walletAddress);

      if (followsError) throw followsError;

      const followedWallets = (follows ?? []).map((f) => f.following_wallet);
      if (followedWallets.length === 0) return [];

      // Step 2: fetch photos from followed creators
      const { data, error } = await supabase
        .from("photos")
        .select(
          `
          *,
          creator:users!creator_id(*)
        `
        )
        .in("creator_wallet", followedWallets)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
  });
}

export function useRefreshFeed() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["photos"] });
    queryClient.invalidateQueries({ queryKey: ["vouches"] });
    queryClient.invalidateQueries({ queryKey: ["follows"] });
    queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
  };
}
