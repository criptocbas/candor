import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import { useAuthStore } from "../stores/authStore";
import { Notification } from "../types";

interface RealtimeNotification {
  visible: boolean;
  notification: Notification | null;
}

export function useRealtimeNotifications(walletAddress: string | null) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<RealtimeNotification>({
    visible: false,
    notification: null,
  });
  const hasSeenFirstVouch = useAuthStore((s) => s.hasSeenFirstVouchCelebration);
  const setFirstVouchSeen = useAuthStore((s) => s.setFirstVouchCelebrationSeen);
  const [showFirstVouchCelebration, setShowFirstVouchCelebration] = useState(false);
  const [firstVouchAmount, setFirstVouchAmount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    const channel = supabase
      .channel(`notifications:${walletAddress}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_wallet=eq.${walletAddress}`,
        },
        async (payload) => {
          const newNotif = payload.new as Notification;

          // Haptic feedback
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Invalidate queries to refresh badges and notification list
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["earnings"] });
          queryClient.invalidateQueries({ queryKey: ["photos"] });
          queryClient.invalidateQueries({ queryKey: ["streak"] });

          // Fetch actor info for display
          let actorName = newNotif.actor_wallet.slice(0, 4) + "..." + newNotif.actor_wallet.slice(-4);
          try {
            const { data: actor } = await supabase
              .from("users")
              .select("display_name, avatar_url")
              .eq("wallet_address", newNotif.actor_wallet)
              .maybeSingle();
            if (actor) {
              newNotif.actor = {
                id: "",
                wallet_address: newNotif.actor_wallet,
                display_name: actor.display_name,
                avatar_url: actor.avatar_url,
                current_streak: 0,
                longest_streak: 0,
                last_verified_date: null,
                created_at: "",
              };
              actorName = actor.display_name;
            }
          } catch {}

          // Check for first vouch celebration
          if (newNotif.type === "vouch" && !hasSeenFirstVouch) {
            // Check if this is truly the first vouch
            const { count } = await supabase
              .from("vouches")
              .select("*", { count: "exact", head: true })
              .in(
                "photo_id",
                (
                  await supabase
                    .from("photos")
                    .select("id")
                    .eq("creator_wallet", walletAddress)
                ).data?.map((p) => p.id) ?? []
              );

            if (count !== null && count <= 1) {
              setFirstVouchAmount(newNotif.amount_lamports ?? 0);
              setShowFirstVouchCelebration(true);
              setFirstVouchSeen();
            }
          }

          // Show in-app toast
          setToast({ visible: true, notification: newNotif });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [walletAddress, queryClient, hasSeenFirstVouch, setFirstVouchSeen]);

  const dismissToast = useCallback(() => {
    setToast({ visible: false, notification: null });
  }, []);

  const dismissFirstVouchCelebration = useCallback(() => {
    setShowFirstVouchCelebration(false);
  }, []);

  return {
    toast,
    dismissToast,
    showFirstVouchCelebration,
    firstVouchAmount,
    dismissFirstVouchCelebration,
  };
}
