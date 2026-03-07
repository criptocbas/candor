import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, TextInput, StatusBar, ActivityIndicator, Pressable } from "react-native";
import { CameraView } from "expo-camera";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useCamera } from "../hooks/useCamera";
import { useVerification } from "../hooks/useVerification";
import { useWallet } from "../hooks/useWallet";
import { useStreak } from "../hooks/useStreak";
import { StreakBadge } from "../components/StreakBadge";
import { VerificationFlow } from "../components/VerificationFlow";
import { VerificationBadge } from "../components/VerificationBadge";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export function CameraScreen() {
  const insets = useSafeAreaInsets();
  const {
    cameraRef,
    permission,
    requestPermission,
    isCapturing,
    lastCapture,
    capture,
    clearCapture,
  } = useCamera();
  const { verifyAndUpload, isVerifying, error, clearError, verificationStep, resetStep } = useVerification();
  const { connected, walletAddress } = useWallet();
  const { data: streak } = useStreak(walletAddress);
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [includeLocation, setIncludeLocation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync hook error to local state for inline display
  useEffect(() => {
    if (error) setVerifyError(error);
  }, [error]);

  const dismissSuccess = useCallback(() => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setShowSuccess(false);
    clearCapture();
    setCaption("");
    setVerifyError(null);
    resetStep();
  }, [clearCapture, resetStep]);

  // Ring pulse animation values
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const ringPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const handleCapture = async () => {
    // White flash
    flashOpacity.value = 0.6;
    flashOpacity.value = withTiming(0, { duration: 150 });

    // Trigger ring pulse
    ringScale.value = 1;
    ringOpacity.value = 0.6;
    ringScale.value = withSpring(1.8, { damping: 20, stiffness: 80 });
    ringOpacity.value = withTiming(0, { duration: 500 });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await capture(includeLocation);
  };

  // Permission: loading
  if (!permission) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Permission: denied
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Text className="text-text-primary text-lg font-display-bold text-center">
          Camera Access Required
        </Text>
        <Text className="text-text-tertiary text-sm text-center leading-5">
          Candor needs your camera to capture and verify photos on-chain.
        </Text>
        <AnimatedPressable
          haptic="light"
          onPress={requestPermission}
          className="bg-primary rounded-2xl px-8 py-4 mt-2"
        >
          <Text className="text-background font-display-semibold text-base">
            Grant Permission
          </Text>
        </AnimatedPressable>
      </View>
    );
  }

  // ─── Post-capture review ────────────────────────────────────────────
  if (lastCapture) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="light-content" />

        {/* Preview image — full bleed */}
        <Image
          source={{ uri: lastCapture.imageUri }}
          style={{ flex: 1, width: "100%" }}
          contentFit="cover"
          transition={200}
        />

        {/* Success overlay */}
        {showSuccess && (
          <Pressable
            onPress={dismissSuccess}
            className="absolute inset-0 bg-black/70 items-center justify-center"
          >
            <VerificationBadge size="lg" animate />
            <Text className="text-text-primary font-display-bold text-xl mt-4">
              Verified & Posted
            </Text>
            {streak && streak.currentStreak > 0 && (
              <View style={{ marginTop: 12 }}>
                <StreakBadge
                  currentStreak={streak.currentStreak}
                  verifiedToday={true}
                  size="md"
                />
              </View>
            )}
            <Text className="text-text-tertiary text-xs mt-3">
              Tap to dismiss
            </Text>
          </Pressable>
        )}

        {/* Bottom controls — floating over preview */}
        {!showSuccess && (
          <View
            className="absolute bottom-0 left-0 right-0"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            {/* Smooth gradient backdrop */}
            <View className="absolute inset-0" pointerEvents="none">
              <View style={{ flex: 1, backgroundColor: "rgba(10,10,15,0)" }} />
              <View style={{ flex: 0.5, backgroundColor: "rgba(10,10,15,0.1)" }} />
              <View style={{ flex: 0.5, backgroundColor: "rgba(10,10,15,0.25)" }} />
              <View style={{ flex: 0.8, backgroundColor: "rgba(10,10,15,0.45)" }} />
              <View style={{ flex: 1, backgroundColor: "rgba(10,10,15,0.65)" }} />
              <View style={{ flex: 2, backgroundColor: "rgba(10,10,15,0.88)" }} />
            </View>

            <View className="px-5 pt-12 gap-4">
              {/* Caption input */}
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption..."
                placeholderTextColor={colors.textTertiary}
                className="rounded-2xl px-4 py-3.5 text-text-primary text-base"
                style={{ backgroundColor: "rgba(20,20,26,0.9)" }}
                maxLength={200}
                multiline
              />

              {/* Error message with retry */}
              {verifyError && (
                <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(207,102,121,0.12)", borderWidth: 1, borderColor: "rgba(207,102,121,0.25)", borderRadius: 16 }}>
                  <Text className="text-error text-sm font-display-semibold mb-1">
                    Verification failed
                  </Text>
                  <Text className="text-text-secondary text-xs leading-4">
                    {verifyError}
                  </Text>
                </View>
              )}

              {/* Hero CTA — Verify & Post (or Retry) */}
              <AnimatedPressable
                haptic="medium"
                onPress={async () => {
                  setVerifyError(null);
                  clearError();
                  const result = await verifyAndUpload(lastCapture, caption);
                  if (result) {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                    // Refresh streak data after verification
                    queryClient.invalidateQueries({ queryKey: ["streak"] });
                    // Let the verification flow show "confirmed" for a moment
                    setTimeout(() => {
                      setShowSuccess(true);
                      resetStep();
                      successTimeoutRef.current = setTimeout(() => {
                        dismissSuccess();
                      }, 1500);
                    }, 1200);
                  } else {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Error
                    );
                  }
                }}
                disabled={isVerifying || !connected}
                style={!connected ? { opacity: 0.4 } : undefined}
                className={`rounded-2xl py-4.5 items-center ${
                  connected ? "bg-primary" : "bg-surface-raised"
                }`}
              >
                <Text
                  className={`text-base font-display-semibold ${
                    connected ? "text-background" : "text-text-tertiary"
                  }`}
                >
                  {isVerifying
                    ? "Verifying..."
                    : verifyError
                      ? "Retry Verification"
                      : connected
                        ? "Verify & Post"
                        : "Connect Wallet"}
                </Text>
              </AnimatedPressable>

              {/* Secondary — Retake */}
              <AnimatedPressable
                haptic="light"
                onPress={() => {
                  clearCapture();
                  setCaption("");
                  setVerifyError(null);
                  clearError();
                  resetStep();
                }}
                className="items-center py-2"
              >
                <Text className="text-text-tertiary text-sm font-medium">
                  Retake
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Verification flow animation (replaces LoadingOverlay) */}
        <VerificationFlow
          visible={isVerifying && verificationStep >= 0}
          imageHash={lastCapture.imageHash}
          currentStep={verificationStep >= 0 ? verificationStep : 0}
        />
      </View>
    );
  }

  // ─── Camera viewfinder ──────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing}>
        {/* Flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            flashStyle,
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#FFFFFF",
            },
          ]}
        />

        {/* Flip camera — top left */}
        <AnimatedPressable
          haptic="light"
          scaleValue={0.92}
          onPress={() => setFacing(f => f === "back" ? "front" : "back")}
          style={{ position: "absolute", top: insets.top + 12, left: 16 }}
        >
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
          </View>
        </AnimatedPressable>

        {/* GPS floating pill — top right */}
        <AnimatedPressable
          haptic="light"
          scaleValue={0.92}
          onPress={() => setIncludeLocation((v) => !v)}
          style={{ position: "absolute", top: insets.top + 12, right: 16 }}
        >
          <View
            className="flex-row items-center rounded-full px-3.5 py-2.5"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              borderWidth: 1,
              borderColor: includeLocation ? "rgba(74,222,128,0.3)" : "transparent",
            }}
          >
            <Ionicons
              name={includeLocation ? "location" : "location-outline"}
              size={14}
              color={includeLocation ? colors.success : colors.textTertiary}
              style={{ marginRight: 6 }}
            />
            <Text style={{
              fontSize: 12,
              color: includeLocation ? colors.success : colors.textSecondary,
              fontFamily: "SpaceGrotesk_600SemiBold",
            }}>
              {includeLocation ? "Location on" : "Location off"}
            </Text>
          </View>
        </AnimatedPressable>

        {/* Streak reminder — top center */}
        {streak && streak.currentStreak > 0 && !streak.verifiedToday && (
          <View
            style={{
              position: "absolute",
              top: insets.top + 12,
              alignSelf: "center",
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14 }}>{streak.currentStreak >= 7 ? "\uD83D\uDD25" : "\u26A1"}</Text>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: "600",
                  fontFamily: "SpaceGrotesk_600SemiBold",
                }}
              >
                Verify today to keep your {streak.currentStreak}-day streak!
              </Text>
            </View>
          </View>
        )}

        {/* Bottom gradient + shutter */}
        <View className="absolute bottom-0 left-0 right-0 items-center">
          {/* Gradient backdrop strips */}
          <View
            className="absolute bottom-0 left-0 right-0"
            pointerEvents="none"
          >
            <View
              style={{ height: 60, backgroundColor: "rgba(0,0,0,0)" }}
            />
            <View
              style={{ height: 40, backgroundColor: "rgba(0,0,0,0.15)" }}
            />
            <View
              style={{ height: 40, backgroundColor: "rgba(0,0,0,0.35)" }}
            />
            <View
              style={{ height: 60, backgroundColor: "rgba(0,0,0,0.55)" }}
            />
          </View>

          {/* Shutter area */}
          <View
            className="items-center"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            {/* Capturing indicator */}
            {isCapturing && (
              <Text className="text-text-secondary text-xs mb-3">
                Processing...
              </Text>
            )}

            {/* Shutter button with ring pulse */}
            <View className="items-center justify-center">
              {/* Expanding ring pulse */}
              <Animated.View
                pointerEvents="none"
                style={[
                  ringPulseStyle,
                  {
                    position: "absolute",
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 2,
                    borderColor: colors.primary,
                  },
                ]}
              />

              {/* Shutter button — amber accent ring */}
              <AnimatedPressable
                haptic="none"
                scaleValue={0.88}
                onPress={handleCapture}
                disabled={isCapturing}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                accessibilityState={{ disabled: isCapturing }}
                style={isCapturing ? { opacity: 0.5 } : undefined}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 4,
                    borderColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                </View>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
