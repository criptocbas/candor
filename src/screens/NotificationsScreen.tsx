import React, { useCallback } from "react";
import { View, Text, SectionList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications, useMarkNotificationsRead } from "../hooks/useNotifications";
import { useWallet } from "../hooks/useWallet";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../components/ui/Avatar";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { timeAgo, truncateAddress, formatSOL } from "../utils/format";
import { colors } from "../theme/colors";
import { Notification, RootStackParamList } from "../types";

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { walletAddress } = useWallet();
  const { data: notifications, isLoading, isRefetching } = useNotifications(walletAddress);
  const { markRead } = useMarkNotificationsRead();
  const queryClient = useQueryClient();

  const groupedNotifications = React.useMemo(() => {
    if (!notifications || notifications.length === 0) return [];

    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const todayItems: Notification[] = [];
    const yesterdayItems: Notification[] = [];
    const earlierItems: Notification[] = [];

    for (const n of notifications) {
      const dateStr = new Date(n.created_at).toDateString();
      if (dateStr === today) {
        todayItems.push(n);
      } else if (dateStr === yesterdayStr) {
        yesterdayItems.push(n);
      } else {
        earlierItems.push(n);
      }
    }

    const sections: { title: string; data: Notification[] }[] = [];
    if (todayItems.length > 0) sections.push({ title: "Today", data: todayItems });
    if (yesterdayItems.length > 0) sections.push({ title: "Yesterday", data: yesterdayItems });
    if (earlierItems.length > 0) sections.push({ title: "Earlier", data: earlierItems });

    return sections;
  }, [notifications]);

  // Mark all as read after a delay so users can see unread indicators
  useFocusEffect(
    useCallback(() => {
      if (!walletAddress) return;
      const timer = setTimeout(() => {
        markRead(walletAddress);
      }, 4000);
      return () => clearTimeout(timer);
    }, [walletAddress, markRead])
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handlePress = (notification: Notification) => {
    if (notification.type === "vouch" && notification.photo_id) {
      navigation.navigate("PhotoDetail", { photoId: notification.photo_id });
    } else if (notification.type === "follow") {
      navigation.navigate("UserProfile", { walletAddress: notification.actor_wallet });
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const actorName =
      item.actor?.display_name || truncateAddress(item.actor_wallet);

    return (
      <AnimatedPressable haptic="light" onPress={() => handlePress(item)}>
        <View
          className="flex-row items-center px-4 py-3.5 gap-3"
          style={{
            backgroundColor: item.read ? "transparent" : "rgba(232,168,56,0.05)",
          }}
        >
          {/* Unread indicator */}
          {!item.read && (
            <View
              style={{
                position: "absolute",
                left: 4,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.primary,
              }}
            />
          )}

          <Avatar
            uri={item.actor?.avatar_url}
            name={actorName}
            size="md"
          />
          <View className="flex-1">
            <Text className="text-text-primary text-sm" numberOfLines={2}>
              <Text style={{ fontWeight: "700" }}>{actorName}</Text>
              {item.type === "vouch" ? (
                <>
                  <Text> vouched </Text>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
                    {formatSOL(item.amount_lamports ?? 0)}
                  </Text>
                  <Text> on your photo</Text>
                </>
              ) : (
                <Text> followed you</Text>
              )}
            </Text>
            <Text className="text-text-tertiary text-xs mt-0.5">
              {timeAgo(item.created_at)}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  if (isLoading) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top }}
      >
        <View className="px-4 pt-4">
          <Text className="text-text-primary font-display-bold text-xl mb-4">
            Notifications
          </Text>
        </View>
        <View className="px-4 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} className="flex-row items-center gap-3">
              <SkeletonLoader width={36} height={36} borderRadius={18} />
              <View className="flex-1 gap-1.5">
                <SkeletonLoader width="80%" height={14} borderRadius={7} />
                <SkeletonLoader width={60} height={10} borderRadius={5} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-2">
        <Text className="text-text-primary font-display-bold text-xl">
          Notifications
        </Text>
      </View>

      <SectionList
        sections={groupedNotifications}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View className="px-4 pt-5 pb-2" style={{ backgroundColor: colors.background }}>
            <Text className="text-text-tertiary text-xs uppercase tracking-widest font-display-semibold">
              {section.title}
            </Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
        ItemSeparatorComponent={() => (
          <View className="border-b border-border mx-4" />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-32 gap-4">
            <Ionicons name="notifications-off-outline" size={40} color={colors.textTertiary} />
            <Text className="text-text-primary text-lg font-display-semibold text-center">
              No notifications yet
            </Text>
            <Text className="text-text-tertiary text-sm text-center leading-5">
              Vouch for photos and follow creators — when they vouch or follow you back, you'll see it here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}
