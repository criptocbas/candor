import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

interface StreakBadgeProps {
  currentStreak: number;
  verifiedToday: boolean;
  size?: "sm" | "md" | "lg";
}

export function StreakBadge({ currentStreak, verifiedToday, size = "md" }: StreakBadgeProps) {
  const scale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    if (currentStreak > 0) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200 }),
          withTiming(0.2, { duration: 1200 })
        ),
        -1,
        true
      );
    }
  }, [currentStreak]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  if (currentStreak === 0) return null;

  const sizes = {
    sm: { icon: 14, text: 12, px: 8, py: 4, gap: 3 },
    md: { icon: 18, text: 14, px: 12, py: 6, gap: 4 },
    lg: { icon: 24, text: 20, px: 16, py: 8, gap: 6 },
  };

  const s = sizes[size];

  return (
    <Animated.View style={containerStyle}>
      <View style={{ position: "relative" }}>
        {/* Glow effect */}
        <Animated.View
          style={[
            glowStyle,
            {
              position: "absolute",
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              borderRadius: 20,
              backgroundColor: colors.primary,
            },
          ]}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(232,168,56,0.15)",
            borderWidth: 1,
            borderColor: verifiedToday ? "rgba(232,168,56,0.4)" : "rgba(232,168,56,0.2)",
            borderRadius: 16,
            paddingHorizontal: s.px,
            paddingVertical: s.py,
            gap: s.gap,
          }}
        >
          <Text style={{ fontSize: s.icon }}>
            {currentStreak >= 7 ? "\uD83D\uDD25" : "\u26A1"}
          </Text>
          <Text
            style={{
              fontSize: s.text,
              fontWeight: "700",
              color: colors.primary,
              fontFamily: "SpaceGrotesk_700Bold",
            }}
          >
            {currentStreak}
          </Text>
          {size !== "sm" && (
            <Text
              style={{
                fontSize: s.text - 2,
                color: colors.textSecondary,
                fontWeight: "600",
              }}
            >
              day{currentStreak !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
