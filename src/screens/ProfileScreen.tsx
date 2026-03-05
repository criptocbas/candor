import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
// Dynamically imported in handlePickAvatar — requires EAS rebuild to work
// import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "../hooks/useWallet";
import { useUserPhotos, useUserInfo } from "../hooks/usePhotos";
import { useEarnings, useSolPrice } from "../hooks/useEarnings";
import { useFollowCounts } from "../hooks/useFollow";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../services/supabase";
import { uploadAvatar } from "../services/verification";
import { VerificationBadge } from "../components/VerificationBadge";
import { Avatar } from "../components/ui/Avatar";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { truncateAddress, formatSOL, formatUSD } from "../utils/format";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { Photo, RootStackParamList } from "../types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = 16;
const GRID_GAP = 4;
const NUM_COLUMNS = 3;
const TILE_SIZE =
  (SCREEN_WIDTH - SCREEN_PAD * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    connected,
    walletAddress,
    displayName,
    connectWallet,
    disconnectWallet,
  } = useWallet();
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const queryClient = useQueryClient();
  const { data: userInfo } = useUserInfo(walletAddress);
  const { data: photos, isLoading, isRefetching: isRefetchingPhotos } = useUserPhotos(walletAddress);
  const { data: earnings, isRefetching: isRefetchingEarnings } = useEarnings(walletAddress);
  const { data: solPrice } = useSolPrice();
  const { data: followCounts } = useFollowCounts(walletAddress);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const isRefreshing = isRefetchingPhotos || isRefetchingEarnings;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["photos", "user", walletAddress] });
    queryClient.invalidateQueries({ queryKey: ["earnings", walletAddress] });
    queryClient.invalidateQueries({ queryKey: ["sol-price"] });
  };

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

  // ─── Not connected ────────────────────────────────────────────────
  if (!connected) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center px-8 gap-4"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-text-primary text-lg font-display-bold text-center">
          Connect Wallet
        </Text>
        <Text className="text-text-tertiary text-sm text-center leading-5">
          Connect your wallet to view your profile, photos, and earnings.
        </Text>
        <AnimatedPressable
          haptic="light"
          onPress={connectWallet}
          className="bg-primary rounded-2xl px-8 py-4 mt-2"
        >
          <Text className="text-background font-display-semibold text-base">
            Connect Wallet
          </Text>
        </AnimatedPressable>
      </View>
    );
  }

  // ─── Avatar picker ──────────────────────────────────────────────
  const handlePickAvatar = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploadingAvatar(true);
      const avatarUrl = await uploadAvatar(supabase, result.assets[0].uri, walletAddress!);
      await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("wallet_address", walletAddress);
      queryClient.invalidateQueries({ queryKey: ["user-info"] });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ─── Username editing ─────────────────────────────────────────────
  const handleStartEdit = () => {
    setEditName(displayName);
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2) {
      setEditError("Username must be at least 2 characters");
      return;
    }
    if (trimmed === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSavingName(true);
    setEditError(null);
    try {
      const { data: existing } = await supabase
        .from("users")
        .select("wallet_address")
        .eq("display_name", trimmed)
        .maybeSingle();

      if (existing && existing.wallet_address !== walletAddress) {
        setEditError("Username already taken");
        setIsSavingName(false);
        return;
      }

      await supabase
        .from("users")
        .update({ display_name: trimmed })
        .eq("wallet_address", walletAddress);

      setDisplayName(trimmed);
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update username");
    } finally {
      setIsSavingName(false);
    }
  };

  // ─── List header ──────────────────────────────────────────────────
  const headerElement = (
    <View className="px-4 gap-5 pb-4">
      {/* Profile header row */}
      <View className="flex-row items-start justify-between">
        {/* Avatar */}
        <AnimatedPressable
          haptic="light"
          onPress={handlePickAvatar}
          disabled={isUploadingAvatar}
          style={{ marginRight: 12 }}
        >
          <View>
            <Avatar
              uri={userInfo?.avatar_url}
              name={displayName}
              size="lg"
            />
            {isUploadingAvatar && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 28,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        </AnimatedPressable>

        {/* Name + edit */}
        <View className="flex-1 mr-3">
          {isEditing ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  className="bg-surface border border-border rounded-xl px-3 py-2.5 text-text-primary text-base flex-1"
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  placeholderTextColor={colors.textTertiary}
                />
                <AnimatedPressable
                  haptic="light"
                  onPress={handleSaveName}
                  disabled={isSavingName}
                  className="bg-primary rounded-xl px-4 py-2.5"
                >
                  <Text className="text-background font-semibold text-sm">
                    {isSavingName ? "..." : "Save"}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  haptic="none"
                  onPress={handleCancelEdit}
                  className="px-2 py-2.5"
                >
                  <Text className="text-text-tertiary text-sm">Cancel</Text>
                </AnimatedPressable>
              </View>
              {editError && (
                <Text className="text-error text-xs">{editError}</Text>
              )}
            </View>
          ) : (
            <AnimatedPressable haptic="none" onPress={handleStartEdit}>
              <View className="flex-row items-baseline">
                <Text className="text-text-primary font-display-bold text-2xl">
                  {displayName}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={colors.textTertiary} style={{ marginLeft: 8 }} />
              </View>
            </AnimatedPressable>
          )}
        </View>

        {/* Wallet pill — tap to copy, long-press to disconnect */}
        <AnimatedPressable
          haptic="light"
          onPress={async () => {
            if (walletAddress) {
              await Clipboard.setStringAsync(walletAddress);
              Alert.alert("Copied", "Wallet address copied to clipboard.");
            }
          }}
          onLongPress={() => {
            Alert.alert(
              "Disconnect Wallet?",
              "You'll need to reconnect through Phantom to use Candor.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Disconnect", style: "destructive", onPress: disconnectWallet },
              ]
            );
          }}
          className="flex-row items-center rounded-full px-3 py-1.5 mt-1"
          style={{ backgroundColor: "rgba(37,37,46,0.6)" }}
        >
          <View
            className="rounded-full mr-1.5"
            style={{ width: 6, height: 6, backgroundColor: colors.success }}
          />
          <Text className="text-text-tertiary text-xs">
            {walletAddress ? truncateAddress(walletAddress, 4) : ""}
          </Text>
          <Ionicons name="copy-outline" size={10} color={colors.textTertiary} style={{ marginLeft: 4 }} />
        </AnimatedPressable>
      </View>

      {/* Follower / Following counts */}
      <Text className="text-text-tertiary text-xs">
        {followCounts?.followers ?? 0} Followers{" · "}
        {followCounts?.following ?? 0} Following
      </Text>

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
        title="Your Photos"
        subtitle={`${photos?.length ?? 0} verified`}
      />
    </View>
  );

  // ─── Photo tile ───────────────────────────────────────────────────
  const renderPhotoTile = ({ item, index }: { item: Photo; index: number }) => {
    const isLeftEdge = index % NUM_COLUMNS === 0;
    const isRightEdge = index % NUM_COLUMNS === NUM_COLUMNS - 1;

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

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <FlatList
        data={photos}
        renderItem={renderPhotoTile}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={headerElement}
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
            <Ionicons name="camera-outline" size={40} color={colors.textTertiary} />
            <Text className="text-text-primary text-lg font-display-semibold text-center">
              No photos yet
            </Text>
            <Text className="text-text-tertiary text-sm text-center leading-5">
              Capture your first verified moment!
            </Text>
            <AnimatedPressable
              haptic="light"
              onPress={() => navigation.getParent()?.navigate("Camera")}
              className="bg-primary rounded-full px-6 py-3 mt-2"
            >
              <Text className="text-background font-display-semibold text-sm">
                Open Camera
              </Text>
            </AnimatedPressable>
          </View>
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
