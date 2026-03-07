import React, { useEffect, useCallback } from "react";
import { View, Text, Modal, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface VerificationStep {
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: VerificationStep[] = [
  {
    label: "Computing SHA-256 Hash",
    sublabel: "Fingerprinting image bytes",
    icon: "finger-print-outline",
  },
  {
    label: "Signing Transaction",
    sublabel: "Wallet authorization via MWA",
    icon: "key-outline",
  },
  {
    label: "Broadcasting to Solana",
    sublabel: "Submitting to devnet validators",
    icon: "globe-outline",
  },
  {
    label: "Confirmed On-Chain",
    sublabel: "Immutably recorded on Solana",
    icon: "shield-checkmark",
  },
];

interface VerificationFlowProps {
  visible: boolean;
  imageHash?: string;
  currentStep: number; // 0-3, driven by parent
  onComplete?: () => void;
}

function HashDisplay({ hash, revealed }: { hash: string; revealed: boolean }) {
  const displayHash = hash.slice(0, 16);
  const charOpacities = Array.from({ length: 16 }, () => useSharedValue(0));

  useEffect(() => {
    if (revealed) {
      charOpacities.forEach((opacity, i) => {
        opacity.value = withDelay(i * 60, withTiming(1, { duration: 150 }));
      });
    } else {
      charOpacities.forEach((opacity) => {
        opacity.value = 0;
      });
    }
  }, [revealed]);

  return (
    <View className="flex-row items-center justify-center mt-3 mb-1">
      <View
        className="rounded-xl px-3 py-2 flex-row"
        style={{ backgroundColor: "rgba(232,168,56,0.08)", borderWidth: 1, borderColor: "rgba(232,168,56,0.15)" }}
      >
        {displayHash.split("").map((char, i) => {
          const style = useAnimatedStyle(() => ({
            opacity: charOpacities[i].value,
            transform: [
              { translateY: interpolate(charOpacities[i].value, [0, 1], [8, 0]) },
            ],
          }));
          return (
            <Animated.Text
              key={i}
              style={[
                style,
                {
                  fontFamily: "SpaceGrotesk_600SemiBold",
                  fontSize: 13,
                  color: colors.primary,
                  letterSpacing: 1.5,
                },
              ]}
            >
              {char}
            </Animated.Text>
          );
        })}
        <Text
          style={{
            fontFamily: "SpaceGrotesk_600SemiBold",
            fontSize: 13,
            color: colors.textTertiary,
            letterSpacing: 1.5,
          }}
        >
          ...
        </Text>
      </View>
    </View>
  );
}

function StepIndicator({
  step,
  index,
  currentStep,
  isActive,
  isComplete,
}: {
  step: VerificationStep;
  index: number;
  currentStep: number;
  isActive: boolean;
  isComplete: boolean;
}) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-20);
  const iconScale = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const lineWidth = useSharedValue(0);

  useEffect(() => {
    if (currentStep >= index) {
      const delay = index === currentStep ? 0 : 0;
      opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
      translateX.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
      iconScale.value = withDelay(delay + 100, withSpring(1, { damping: 10, stiffness: 200 }));
    }
  }, [currentStep]);

  useEffect(() => {
    if (isActive) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isActive]);

  useEffect(() => {
    if (isComplete) {
      checkScale.value = withSpring(1, { damping: 8, stiffness: 200 });
      lineWidth.value = withTiming(1, { duration: 400 });
    }
  }, [isComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value * pulseScale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    height: interpolate(lineWidth.value, [0, 1], [0, 32]),
    opacity: lineWidth.value,
  }));

  const isFinal = index === STEPS.length - 1;
  const iconColor = isComplete
    ? colors.success
    : isActive
    ? colors.primary
    : colors.textTertiary;
  const bgColor = isComplete
    ? "rgba(74,222,128,0.12)"
    : isActive
    ? "rgba(232,168,56,0.12)"
    : "rgba(102,102,102,0.08)";
  const borderColor = isComplete
    ? "rgba(74,222,128,0.25)"
    : isActive
    ? "rgba(232,168,56,0.25)"
    : "transparent";

  return (
    <Animated.View style={containerStyle}>
      <View className="flex-row items-start" style={{ marginBottom: isFinal ? 0 : 4 }}>
        {/* Icon column */}
        <View className="items-center" style={{ width: 44 }}>
          <Animated.View
            style={[
              iconContainerStyle,
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: bgColor,
                borderWidth: 1.5,
                borderColor,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            {isComplete ? (
              <Animated.View style={checkStyle}>
                <Ionicons name="checkmark" size={22} color={colors.success} />
              </Animated.View>
            ) : (
              <Ionicons name={step.icon} size={20} color={iconColor} />
            )}
          </Animated.View>

          {/* Connecting line */}
          {!isFinal && (
            <Animated.View
              style={[
                lineStyle,
                {
                  width: 2,
                  backgroundColor: isComplete ? colors.success : "rgba(102,102,102,0.2)",
                  marginTop: 4,
                },
              ]}
            />
          )}
        </View>

        {/* Text column */}
        <View className="ml-3 pt-1 flex-shrink" style={{ paddingTop: 2 }}>
          <Text
            style={{
              fontFamily: "SpaceGrotesk_600SemiBold",
              fontSize: 15,
              color: isActive || isComplete ? colors.textPrimary : colors.textTertiary,
            }}
          >
            {step.label}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textTertiary,
              marginTop: 2,
            }}
          >
            {step.sublabel}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function VerificationFlow({
  visible,
  imageHash = "",
  currentStep,
  onComplete,
}: VerificationFlowProps) {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.9);
  const successScale = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  // Fire haptics on step changes
  useEffect(() => {
    if (!visible) return;
    if (currentStep < 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStep, visible]);

  useEffect(() => {
    if (visible) {
      bgOpacity.value = withTiming(1, { duration: 300 });
      titleOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
      titleScale.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 120 }));
    } else {
      bgOpacity.value = 0;
      titleOpacity.value = 0;
      titleScale.value = 0.9;
      successScale.value = 0;
      successOpacity.value = 0;
      glowOpacity.value = 0;
    }
  }, [visible]);

  // Final success state
  useEffect(() => {
    if (currentStep === 3 && visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      successScale.value = withSpring(1, { damping: 6, stiffness: 150 });
      successOpacity.value = withTiming(1, { duration: 300 });
      glowOpacity.value = withDelay(
        200,
        withSequence(
          withTiming(0.6, { duration: 400 }),
          withTiming(0.2, { duration: 600 })
        )
      );
    }
  }, [currentStep, visible]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const successBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const isComplete = currentStep === 3;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View
        style={[bgStyle, { flex: 1, backgroundColor: "rgba(10,10,15,0.95)" }]}
        className="items-center justify-center px-8"
      >
        {/* Gold glow behind content on completion */}
        {isComplete && (
          <Animated.View
            pointerEvents="none"
            style={[
              glowStyle,
              {
                position: "absolute",
                width: 300,
                height: 300,
                borderRadius: 150,
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 80,
                elevation: 20,
              },
            ]}
          />
        )}

        {/* Title */}
        <Animated.View style={titleStyle} className="items-center mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons
              name="shield-half-outline"
              size={20}
              color={isComplete ? colors.success : colors.primary}
            />
            <Text
              style={{
                fontFamily: "SpaceGrotesk_700Bold",
                fontSize: 22,
                color: colors.textPrimary,
              }}
            >
              {isComplete ? "Verified" : "Verifying Photo"}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: "center" }}>
            {isComplete
              ? "Your photo is permanently sealed on Solana"
              : "Sealing your photo on the Solana blockchain"}
          </Text>
        </Animated.View>

        {/* Hash display (visible from step 0) */}
        {imageHash && <HashDisplay hash={imageHash} revealed={currentStep >= 0 && visible} />}

        {/* Steps */}
        <View className="w-full mt-6" style={{ maxWidth: 320 }}>
          {STEPS.map((step, i) => (
            <StepIndicator
              key={i}
              step={step}
              index={i}
              currentStep={currentStep}
              isActive={currentStep === i}
              isComplete={currentStep > i || (i === 3 && currentStep === 3)}
            />
          ))}
        </View>

        {/* Success badge */}
        {isComplete && (
          <Animated.View style={successBadgeStyle} className="items-center mt-8">
            <View
              className="rounded-full px-6 py-3 flex-row items-center"
              style={{
                backgroundColor: "rgba(74,222,128,0.12)",
                borderWidth: 1.5,
                borderColor: "rgba(74,222,128,0.3)",
              }}
            >
              <Ionicons name="shield-checkmark" size={18} color={colors.success} />
              <Text
                style={{
                  fontFamily: "SpaceGrotesk_600SemiBold",
                  fontSize: 14,
                  color: colors.success,
                  marginLeft: 8,
                }}
              >
                VERIFIED ON SOLANA
              </Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}
