import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Linking,
  Dimensions,
  Alert,
  Pressable,
  ActivityIndicator,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { usePhotoDetail, usePhotoVouches } from "../hooks/usePhotos";
import { useVouch } from "../hooks/useVouch";
import { useWallet } from "../hooks/useWallet";
import { useSolPrice } from "../hooks/useEarnings";
import { VerificationBadge } from "../components/VerificationBadge";
import { VouchButton } from "../components/VouchButton";
import { Avatar } from "../components/ui/Avatar";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { BoostModal } from "../components/BoostModal";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { VouchSuccessToast } from "../components/ui/VouchSuccessToast";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import {
  truncateAddress,
  timeAgo,
  formatSOL,
  formatUSD,
} from "../utils/format";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { getExplorerUrl } from "../services/solana";
import { RootStackParamList, Vouch } from "../types";
import { useDoubleTap } from "../hooks/useDoubleTap";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function PhotoDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, "PhotoDetail">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { photoId } = route.params;

  const { data: photo, isLoading, isError, refetch } = usePhotoDetail(photoId);
  const { data: vouches } = usePhotoVouches(photoId);
  const { vouch, isVouching, error, clearError, defaultAmount, lastSuccess, clearSuccess } = useVouch();
  const { walletAddress } = useWallet();
  const { data: solPrice } = useSolPrice();
  const [boostModalVisible, setBoostModalVisible] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showVouchConfirm, setShowVouchConfirm] = useState(false);

  useEffect(() => {
    if (lastSuccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccessToast(true);
    }
  }, [lastSuccess]);

  // Content entrance animation
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(12);

  useEffect(() => {
    if (photo) {
      contentOpacity.value = withDelay(
        150,
        withTiming(1, { duration: 350 })
      );
      contentTranslateY.value = withDelay(
        150,
        withSpring(0, { damping: 20, stiffness: 130 })
      );
    }
  }, [photo]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  useEffect(() => {
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Vouch Failed", error);
      clearError();
    }
  }, [error, clearError]);

  const hasVouched = vouches?.some((v) => v.voucher_wallet === walletAddress);
  const isOwnPhoto = walletAddress === photo?.creator_wallet;

  const handleDoubleTapVouch = useCallback(() => {
    if (!photo || isOwnPhoto || hasVouched || isVouching) return;
    setShowVouchConfirm(true);
  }, [photo, isOwnPhoto, hasVouched, isVouching]);

  const { handlePress: handleImagePress } = useDoubleTap({
    onDoubleTap: handleDoubleTapVouch,
  });

  if (isError) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Text className="text-text-primary text-lg font-display-semibold text-center">
          Something went wrong
        </Text>
        <Text className="text-text-tertiary text-sm text-center leading-5">
          We couldn't load this photo. Check your connection and try again.
        </Text>
        <AnimatedPressable
          haptic="light"
          onPress={() => refetch()}
          className="bg-primary rounded-2xl px-8 py-4 mt-2"
        >
          <Text className="text-background font-display-semibold text-base">
            Retry
          </Text>
        </AnimatedPressable>
      </View>
    );
  }

  if (isLoading || !photo) {
    return (
      <View className="flex-1 bg-background">
        {/* Image skeleton */}
        <SkeletonLoader
          width={SCREEN_WIDTH}
          height={SCREEN_WIDTH * 1.25}
          borderRadius={0}
        />
        {/* Content skeleton */}
        <View className="px-4 py-4 gap-4">
          <View className="flex-row items-center justify-between">
            <SkeletonLoader width={140} height={18} borderRadius={8} />
            <SkeletonLoader width={60} height={14} borderRadius={6} />
          </View>
          <SkeletonLoader width="80%" height={16} borderRadius={8} />
          <SkeletonLoader width={100} height={36} borderRadius={18} />
          <View style={{ height: 8 }} />
          <SkeletonLoader width="100%" height={120} borderRadius={16} />
          <View style={{ height: 8 }} />
          <SkeletonLoader width={140} height={20} borderRadius={8} />
          <SkeletonLoader width="100%" height={160} borderRadius={16} />
        </View>
      </View>
    );
  }

  const handleVouch = () => {
    setShowVouchConfirm(true);
  };

  const confirmVouch = async () => {
    setShowVouchConfirm(false);
    await vouch(
      photo.id,
      photo.creator_wallet,
      photo.image_hash,
      defaultAmount
    );
  };

  const handleShare = async () => {
    if (!photo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const creatorName = photo.creator?.display_name || truncateAddress(photo.creator_wallet, 6);
    const hashPreview = photo.image_hash.slice(0, 16);
    const explorerUrl = photo.verification_tx
      ? getExplorerUrl(photo.verification_tx)
      : null;

    const message = [
      `Verified photo by ${creatorName} on Candor`,
      ``,
      `SHA-256: ${hashPreview}...`,
      photo.vouch_count > 0 ? `${photo.vouch_count} vouches | ${formatSOL(photo.total_earned_lamports)} earned` : null,
      ``,
      `Every pixel cryptographically sealed on Solana at capture.`,
      explorerUrl ? `\nVerify on-chain: ${explorerUrl}` : null,
      ``,
      `#Candor #SolanaVerified #ProofOfCapture`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await Share.share({
        message,
        url: photo.image_url,
      });
    } catch (err) {
      // User cancelled share — no action needed
    }
  };

  const handleBoost = async (amountLamports: number) => {
    const result = await vouch(
      photo.id,
      photo.creator_wallet,
      photo.image_hash,
      amountLamports
    );
    if (result) {
      setBoostModalVisible(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
    >
      {/* Full photo — double-tap to vouch */}
      <Pressable onPress={handleImagePress}>
        <Image
          source={{ uri: photo.image_url }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.25 }}
          contentFit="cover"
          transition={200}
        />
      </Pressable>

      <Animated.View style={contentStyle} className="px-4 py-5 gap-5">
        {/* Creator info + verification */}
        <View className="flex-row items-center justify-between">
          <AnimatedPressable
            haptic="light"
            onPress={() =>
              navigation.navigate("UserProfile", {
                walletAddress: photo.creator_wallet,
              })
            }
            className="flex-row items-center"
          >
            <View style={{ marginRight: 8 }}>
              <Avatar
                uri={photo.creator?.avatar_url}
                name={photo.creator?.display_name || truncateAddress(photo.creator_wallet)}
                size="sm"
              />
            </View>
            <Text className="text-text-primary font-display-semibold text-base">
              {photo.creator?.display_name ||
                truncateAddress(photo.creator_wallet)}
            </Text>
            {photo.verification_tx && (
              <View className="ml-1.5">
                <VerificationBadge size="md" />
              </View>
            )}
          </AnimatedPressable>
          <Text className="text-text-tertiary text-xs">
            {timeAgo(photo.created_at)}
          </Text>
        </View>

        {/* Caption */}
        {photo.caption && (
          <Text className="text-text-secondary text-base leading-6">
            {photo.caption}
          </Text>
        )}

        {/* Vouch action + earnings row */}
        <View className="flex-row items-center justify-between">
          {!isOwnPhoto && (
            <View className="flex-row items-center gap-2">
              <VouchButton
                amountLamports={defaultAmount}
                vouchCount={photo.vouch_count}
                onPress={handleVouch}
                isLoading={isVouching}
                hasVouched={hasVouched}
              />
              {!hasVouched && (
                <AnimatedPressable
                  haptic="light"
                  scaleValue={0.94}
                  onPress={() => setBoostModalVisible(true)}
                  disabled={isVouching}
                >
                  <View
                    className="rounded-full px-3.5 py-2 border border-primary/40"
                    style={{ backgroundColor: "rgba(232,168,56,0.1)" }}
                  >
                    <Text className="text-primary text-xs font-display-semibold">
                      Boost
                    </Text>
                  </View>
                </AnimatedPressable>
              )}
            </View>
          )}
          <View className="flex-row items-center gap-2">
            {photo.total_earned_lamports > 0 && (
              <View className="bg-surface rounded-xl px-3.5 py-2">
                <Text className="text-primary font-display-semibold text-sm">
                  {formatSOL(photo.total_earned_lamports)} earned
                  {solPrice ? (
                    <Text className="text-text-tertiary font-normal text-xs">
                      {" "}({formatUSD(photo.total_earned_lamports, solPrice)})
                    </Text>
                  ) : null}
                </Text>
              </View>
            )}
            {/* Share button */}
            <AnimatedPressable
              haptic="light"
              scaleValue={0.92}
              onPress={handleShare}
            >
              <View
                className="rounded-full items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(240,237,234,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(240,237,234,0.1)",
                }}
              >
                <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* Verification proof */}
        <View>
          <SectionHeader title="Verification Proof" />
          <View className="bg-surface rounded-2xl p-4">
            <ProofRow label="Image Hash" value={photo.image_hash} copyValue={photo.image_hash} mono />

            {photo.verification_tx && (
              <ProofRow
                label="Transaction"
                value={truncateAddress(photo.verification_tx, 8)}
                copyValue={photo.verification_tx}
                onPress={() =>
                  Linking.openURL(getExplorerUrl(photo.verification_tx!))
                }
                isLink
              />
            )}

            <ProofRow
              label="Creator"
              value={truncateAddress(photo.creator_wallet, 6)}
              copyValue={photo.creator_wallet}
              mono
            />

            {photo.latitude != null && photo.longitude != null && (
              <ProofRow
                label="Location"
                value={`${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`}
              />
            )}

            <ProofRow
              label="Captured"
              value={new Date(photo.created_at).toLocaleString()}
              isLast
            />
          </View>
        </View>

        {/* Vouch list */}
        {vouches && vouches.length > 0 && (
          <View style={{ paddingBottom: insets.bottom + 16 }}>
            <SectionHeader
              title="Vouches"
              subtitle={`${vouches.length} total`}
            />
            <View className="bg-surface rounded-2xl p-4">
              {vouches.map((v: Vouch, index: number) => (
                <View
                  key={v.id}
                  className={`flex-row items-center justify-between py-3 ${
                    index < vouches.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <Text className="text-text-secondary text-sm">
                    {v.voucher?.display_name ||
                      truncateAddress(v.voucher_wallet)}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-primary text-sm font-display-semibold">
                      {formatSOL(v.amount_lamports)}
                      {solPrice ? (
                        <Text className="text-text-tertiary font-normal text-xs">
                          {" "}({formatUSD(v.amount_lamports, solPrice)})
                        </Text>
                      ) : null}
                    </Text>
                    <Text className="text-text-tertiary text-xs">
                      {timeAgo(v.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom spacer if no vouches */}
        {(!vouches || vouches.length === 0) && (
          <View style={{ height: insets.bottom + 16 }} />
        )}
      </Animated.View>
    </ScrollView>

    <ConfirmationModal
      visible={showVouchConfirm}
      title="Vouch for this photo?"
      message={`This will send ${formatSOL(defaultAmount)}${solPrice ? ` (${formatUSD(defaultAmount, solPrice)})` : ""} to the creator.`}
      confirmLabel="Vouch"
      onConfirm={confirmVouch}
      onCancel={() => setShowVouchConfirm(false)}
    />

    <BoostModal
      visible={boostModalVisible}
      onClose={() => setBoostModalVisible(false)}
      onBoost={handleBoost}
      isLoading={isVouching}
      creatorName={
        photo.creator?.display_name ||
        truncateAddress(photo.creator_wallet)
      }
    />

    <VouchSuccessToast
      visible={showSuccessToast}
      amount={lastSuccess?.amount ?? 0}
      onDismiss={() => {
        setShowSuccessToast(false);
        clearSuccess();
      }}
    />
    </View>
  );
}

function ProofRow({
  label,
  value,
  copyValue,
  mono = false,
  isLink = false,
  isLast = false,
  onPress,
}: {
  label: string;
  value: string;
  copyValue?: string;
  mono?: boolean;
  isLink?: boolean;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(copyValue || value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const content = (
    <View
      className={`flex-row justify-between items-center py-2.5 ${
        !isLast ? "border-b border-border" : ""
      }`}
    >
      <Text className="text-text-tertiary text-xs">{label}</Text>
      <View className="flex-row items-center gap-2" style={{ maxWidth: "65%" }}>
        <Text
          className={`text-sm ${
            isLink ? "text-primary" : "text-text-secondary"
          }`}
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {value}
        </Text>
        {(copyValue || mono || isLink) && (
          <AnimatedPressable haptic="light" onPress={handleCopy} scaleValue={0.85}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={14}
              color={copied ? colors.success : colors.textTertiary}
            />
          </AnimatedPressable>
        )}
      </View>
    </View>
  );

  if (isLink && onPress) {
    return (
      <AnimatedPressable haptic="light" onPress={onPress}>
        {content}
      </AnimatedPressable>
    );
  }

  return content;
}
