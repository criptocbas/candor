import React, { useEffect } from "react";
import { View, Text, FlatList, RefreshControl, Dimensions, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import { useUserPhotos, useUserInfo } from "../hooks/usePhotos";
import { useEarnings, useSolPrice } from "../hooks/useEarnings";
import { useIsFollowing, useFollowCounts, useToggleFollow } from "../hooks/useFollow";
import { useWallet } from "../hooks/useWallet";
import { VerificationBadge } from "../components/VerificationBadge";
import { Avatar } from "../components/ui/Avatar";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { ErrorState } from "../components/ui/ErrorState";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { truncateAddress, formatSOL, formatUSD } from "../utils/format";
import { colors } from "../theme/colors";
import { Photo, RootStackParamList } from "../types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = 16;
const GRID_GAP = 4;
const NUM_COLUMNS = 3;
const TILE_SIZE =
  (SCREEN_WIDTH - SCREEN_PAD * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, "UserProfile">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { walletAddress } = route.params;

  const { walletAddress: myWallet } = useWallet();
  const queryClient = useQueryClient();
  const { data: userInfo, isLoading: isLoadingUser, isError: isUserError } = useUserInfo(walletAddress);
  const { data: photos, isLoading: isLoadingPhotos, isRefetching: isRefetchingPhotos, isError: isPhotosError } = useUserPhotos(walletAddress);
  const { data: earnings, isRefetching: isRefetchingEarnings } = useEarnings(walletAddress);
  const { data: solPrice } = useSolPrice();
  const { data: isFollowing } = useIsFollowing(myWallet, walletAddress);
  const { data: followCounts } = useFollowCounts(walletAddress);
  const { toggleFollow, isToggling } = useToggleFollow();
  const isOwnProfile = myWallet === walletAddress;
  const isRefreshing = isRefetchingPhotos || isRefetchingEarnings;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["photos", "user", walletAddress] });
    queryClient.invalidateQueries({ queryKey: ["earnings", walletAddress] });
    queryClient.invalidateQueries({ queryKey: ["user-info", walletAddress] });
    queryClient.invalidateQueries({ queryKey: ["follows"] });
  };

  const isLoading = isLoadingUser || isLoadingPhotos;

  const displayName = userInfo?.display_name || truncateAddress(walletAddress);

  // Earnings card entrance animation
  const cardTranslateY = useSharedValue(16);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (earnings) {
      cardTranslateY.value = withSpring(0, { damping: 20, stiffness: 130 });
      cardOpacity.value = withTiming(1, { duration: 400 });
    }
  }, [earnings]);

  const cardEntranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
    opacity: cardOpacity.value,
  }));

  // ─── Error state ─────────────────────────────────────────────────
  if (!isLoading && (isUserError || isPhotosError)) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <ErrorState onRetry={handleRefresh} />
      </View>
    );
  }

  // ─── Loading skeleton ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <View
        className="flex-1 bg-background px-4"
        style={{ paddingTop: insets.top + 16 }}
      >
        {/* Name skeleton */}
        <SkeletonLoader width={140} height={28} borderRadius={8} />
        <View style={{ height: 20 }} />
        {/* Earnings card skeleton */}
        <View className="bg-surface rounded-2xl p-5 gap-4">
          <SkeletonLoader width={80} height={12} borderRadius={6} />
          <SkeletonLoader width={180} height={32} borderRadius={8} />
          <View className="border-b border-border" />
          <View className="flex-row gap-8">
            <View className="gap-2">
              <SkeletonLoader width={40} height={24} borderRadius={6} />
              <SkeletonLoader width={80} height={12} borderRadius={6} />
            </View>
            <View className="gap-2">
              <SkeletonLoader width={40} height={24} borderRadius={6} />
              <SkeletonLoader width={80} height={12} borderRadius={6} />
            </View>
          </View>
        </View>
        <View style={{ height: 24 }} />
        {/* Grid skeleton */}
        <SkeletonLoader width={100} height={20} borderRadius={8} />
        <View style={{ height: 12 }} />
        <View className="flex-row gap-1">
          <SkeletonLoader width={TILE_SIZE} height={TILE_SIZE} borderRadius={8} />
          <SkeletonLoader width={TILE_SIZE} height={TILE_SIZE} borderRadius={8} />
          <SkeletonLoader width={TILE_SIZE} height={TILE_SIZE} borderRadius={8} />
        </View>
      </View>
    );
  }

  // ─── List header ──────────────────────────────────────────────────
  const renderHeader = () => (
    <View className="px-4 gap-5 pb-4">
      {/* Profile header */}
      <View className="flex-row items-center gap-3">
        <Avatar
          uri={userInfo?.avatar_url}
          name={displayName}
          size="lg"
        />
        <Text className="text-text-primary font-display-bold text-2xl flex-1">
          {displayName}
        </Text>
      </View>

      {/* Follow button + counts */}
      {!isOwnProfile && (
        <View className="flex-row items-center gap-3">
          <AnimatedPressable
            haptic="light"
            onPress={() =>
              myWallet &&
              toggleFollow(myWallet, walletAddress, isFollowing ?? false)
            }
            disabled={isToggling}
            accessibilityRole="button"
            accessibilityLabel={isFollowing ? "Unfollow" : "Follow"}
            accessibilityState={{ disabled: isToggling }}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isFollowing ? colors.surface : colors.primary,
              borderWidth: isFollowing ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            {isToggling ? (
              <ActivityIndicator
                size="small"
                color={isFollowing ? colors.textPrimary : colors.background}
              />
            ) : (
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: isFollowing ? colors.textPrimary : colors.background,
                }}
              >
                {isFollowing ? "Following" : "Follow"}
              </Text>
            )}
          </AnimatedPressable>
          <Text className="text-text-tertiary text-xs">
            {followCounts?.followers ?? 0} Followers{" · "}
            {followCounts?.following ?? 0} Following
          </Text>
        </View>
      )}

      {/* Earnings card */}
      <Animated.View style={cardEntranceStyle}>
        <View style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(232,168,56,0.2)",
        }}>
          <View className="bg-surface rounded-2xl p-5 gap-4">
            {/* Main earnings */}
            <View>
              <Text className="text-text-tertiary text-xs uppercase tracking-widest mb-1">
                Total Earned
              </Text>
              <View className="flex-row items-baseline gap-2">
                <Text style={{
                  fontSize: 36,
                  fontFamily: "SpaceGrotesk_700Bold",
                  color: colors.primary,
                }}>
                  {formatSOL(earnings?.totalEarnedLamports ?? 0)}
                </Text>
                <Text className="text-primary text-lg font-display-semibold">
                  SOL
                </Text>
                {solPrice != null && solPrice > 0 && (
                  <Text className="text-text-tertiary text-sm">
                    {formatUSD(earnings?.totalEarnedLamports ?? 0, solPrice)}
                  </Text>
                )}
              </View>
            </View>

            {/* Divider */}
            <View className="border-b border-border" />

            {/* Stats row */}
            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-text-primary font-display-semibold text-xl">
                  {earnings?.totalVouches ?? 0}
                </Text>
                <Text className="text-text-tertiary text-xs mt-0.5">
                  Vouches received
                </Text>
              </View>
              <View className="border-l border-border mx-4" />
              <View className="flex-1">
                <Text className="text-text-primary font-display-semibold text-xl">
                  {earnings?.photoCount ?? 0}
                </Text>
                <Text className="text-text-tertiary text-xs mt-0.5">
                  Photos verified
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Photos section header */}
      <SectionHeader
        title="Photos"
        subtitle={`${photos?.length ?? 0} verified`}
      />
    </View>
  );

  // ─── Photo tile ───────────────────────────────────────────────────
  const renderPhotoTile = ({ item, index }: { item: Photo; index: number }) => {
    const isLeftEdge = index % NUM_COLUMNS === 0;

    return (
      <AnimatedPressable
        haptic="light"
        scaleValue={0.95}
        onPress={() =>
          navigation.navigate("PhotoDetail", { photoId: item.id })
        }
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          marginLeft: isLeftEdge ? 0 : GRID_GAP,
          marginBottom: GRID_GAP,
        }}
      >
        <View
          style={{ width: TILE_SIZE, height: TILE_SIZE }}
          className="rounded-lg overflow-hidden"
        >
          <Image
            source={{ uri: item.image_url }}
            style={{ width: TILE_SIZE, height: TILE_SIZE }}
            contentFit="cover"
            transition={150}
          />
          {/* Verification badge */}
          {item.verification_tx && (
            <View className="absolute top-1.5 right-1.5">
              <VerificationBadge size="sm" />
            </View>
          )}
          {/* Vouch count */}
          {item.vouch_count > 0 && (
            <View
              className="absolute bottom-1.5 left-1.5 rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              <Text className="text-primary text-xs font-bold">
                {item.vouch_count}
              </Text>
            </View>
          )}
        </View>
      </AnimatedPressable>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={photos}
        renderItem={renderPhotoTile}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center px-8 py-16 gap-4">
            <Text className="text-text-primary text-lg font-display-semibold text-center">
              No photos yet
            </Text>
            <Text className="text-text-tertiary text-sm text-center leading-5">
              This user hasn't posted any photos yet.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
