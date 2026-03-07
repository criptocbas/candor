import React, { useEffect, useCallback } from "react";
import { View, Text, Dimensions, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { VerificationBadge } from "./VerificationBadge";
import { VouchButton } from "./VouchButton";
import { Avatar } from "./ui/Avatar";
import { AnimatedPressable } from "./ui/AnimatedPressable";
import { Photo, RootStackParamList } from "../types";
import { timeAgo, truncateAddress, formatSOL, formatUSD } from "../utils/format";
import { colors } from "../theme/colors";
import { useDoubleTap } from "../hooks/useDoubleTap";
import { useSolPrice } from "../hooks/useEarnings";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PADDING = 16;
const IMAGE_WIDTH = SCREEN_WIDTH - SCREEN_PADDING * 2;

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onPress: () => void;
  onVouch: () => void;
  isVouching?: boolean;
  hasVouched?: boolean;
  isOwnPhoto?: boolean;
  vouchAmount?: number;
  showDoubleTapHint?: boolean;
  onHintShown?: () => void;
}

export function PhotoCard({
  photo,
  index,
  onPress,
  onVouch,
  isVouching = false,
  hasVouched = false,
  isOwnPhoto = false,
  vouchAmount = 5_000_000,
  showDoubleTapHint = false,
  onHintShown,
}: PhotoCardProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: solPrice } = useSolPrice();
  const creatorName =
    photo.creator?.display_name || truncateAddress(photo.creator_wallet);

  // Staggered entrance animation
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 60;
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 16, stiffness: 110 })
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
  }, []);

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Double-tap hint overlay
  const hintOpacity = useSharedValue(showDoubleTapHint ? 1 : 0);

  useEffect(() => {
    if (showDoubleTapHint) {
      hintOpacity.value = withTiming(1, { duration: 400 });
      const timer = setTimeout(() => {
        hintOpacity.value = withTiming(0, { duration: 400 });
        onHintShown?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showDoubleTapHint]);

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  // Double-tap vouch burst animation
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconOpacity = useSharedValue(0);

  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstScale.value }],
    opacity: burstOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const handleDoubleTapVouch = useCallback(() => {
    if (isOwnPhoto || hasVouched || isVouching) return;

    // 1. Center icon: pop in with overshoot, then fade
    iconScale.value = 0;
    iconOpacity.value = 1;
    iconScale.value = withSequence(
      withSpring(1.4, { damping: 6, stiffness: 140 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );
    iconOpacity.value = withDelay(600, withTiming(0, { duration: 300 }));

    // 2. Ring: expand outward and fade
    ringScale.value = 0.3;
    ringOpacity.value = 0.8;
    ringScale.value = withSpring(2.5, { damping: 12, stiffness: 60 });
    ringOpacity.value = withDelay(200, withTiming(0, { duration: 500 }));

    // 3. Burst glow: radial pulse
    burstScale.value = 0.5;
    burstOpacity.value = 0.6;
    burstScale.value = withSpring(3, { damping: 15, stiffness: 50 });
    burstOpacity.value = withDelay(100, withTiming(0, { duration: 600 }));

    onVouch();
  }, [isOwnPhoto, hasVouched, isVouching, onVouch]);

  const { handlePress: handleImagePress } = useDoubleTap({
    onDoubleTap: handleDoubleTapVouch,
    onSingleTap: onPress,
  });

  return (
    <Animated.View style={entranceStyle} className="mb-4">
      <AnimatedPressable haptic="light" scaleValue={0.98} onPress={onPress}>
        <View className="bg-surface rounded-2xl overflow-hidden">
          {/* Photo — full card width */}
          <Pressable onPress={handleImagePress}>
            <Image
              source={{ uri: photo.image_url }}
              style={{ width: IMAGE_WIDTH, aspectRatio: 4 / 5 }}
              contentFit="cover"
              transition={200}
            />
            {/* Double-tap vouch burst — layered animation */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Layer 1: Soft radial glow */}
              <Animated.View
                style={[
                  burstStyle,
                  {
                    position: "absolute",
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: "rgba(232,168,56,0.15)",
                  },
                ]}
              />
              {/* Layer 2: Expanding ring */}
              <Animated.View
                style={[
                  ringStyle,
                  {
                    position: "absolute",
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 2.5,
                    borderColor: "rgba(232,168,56,0.5)",
                  },
                ]}
              />
              {/* Layer 3: Center icon with glow */}
              <Animated.View style={iconAnimStyle}>
                <View
                  style={{
                    shadowColor: "#E8A838",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 24,
                    elevation: 12,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={72} color={colors.primary} />
                </View>
              </Animated.View>
            </View>
            {/* Double-tap discovery hint */}
            {showDoubleTapHint && (
              <Animated.View
                pointerEvents="none"
                style={[
                  hintStyle,
                  {
                    position: "absolute",
                    bottom: 16,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.7)",
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name="hand-left-outline" size={14} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                    Double-tap to vouch
                  </Text>
                </View>
              </Animated.View>
            )}
          </Pressable>

          {/* Metadata below photo */}
          <View className="px-4 pt-3 pb-4 gap-2.5">
            {/* Creator row: avatar + name + badge + timestamp */}
            <View className="flex-row items-center">
              <AnimatedPressable
                haptic="light"
                onPress={() =>
                  navigation.navigate("UserProfile", {
                    walletAddress: photo.creator_wallet,
                  })
                }
                className="flex-row items-center"
              >
                <View style={{ marginRight: 6 }}>
                  <Avatar
                    uri={photo.creator?.avatar_url}
                    name={creatorName}
                    size="sm"
                  />
                </View>
                <Text className="text-text-primary font-display-semibold text-sm">
                  {creatorName}
                </Text>
                {photo.verification_tx && (
                  <View className="ml-1.5">
                    <VerificationBadge size="sm" />
                  </View>
                )}
              </AnimatedPressable>
              <View className="flex-1" />
              <Text className="text-text-tertiary text-xs">
                {timeAgo(photo.created_at)}
              </Text>
            </View>

            {/* Caption */}
            {photo.caption && (
              <Text className="text-text-secondary text-sm" numberOfLines={2}>
                {photo.caption}
              </Text>
            )}

            {/* Actions row: vouch button + earnings */}
            <View className="flex-row items-center justify-between">
              {!isOwnPhoto && (
                <VouchButton
                  amountLamports={vouchAmount}
                  vouchCount={photo.vouch_count}
                  onPress={onVouch}
                  isLoading={isVouching}
                  hasVouched={hasVouched}
                />
              )}
              {photo.total_earned_lamports > 0 && (
                <Text className="text-primary text-xs font-semibold">
                  {formatSOL(photo.total_earned_lamports)} earned
                  {solPrice ? (
                    <Text className="text-text-tertiary text-xs font-normal">
                      {" "}({formatUSD(photo.total_earned_lamports, solPrice)})
                    </Text>
                  ) : null}
                </Text>
              )}
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
