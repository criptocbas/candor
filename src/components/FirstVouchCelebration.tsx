import React, { useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { formatSOL } from "../utils/format";
import { colors } from "../theme/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface FirstVouchCelebrationProps {
  visible: boolean;
  amountLamports: number;
  onDismiss: () => void;
}

function Particle({ delay, x, y }: { delay: number; x: number; y: number }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay, withTiming(y, { duration: 1500, easing: Easing.out(Easing.quad) }));
    translateX.value = withDelay(delay, withTiming(x, { duration: 1500, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(800, withTiming(0, { duration: 500 }))
    ));
    scale.value = withDelay(delay, withSequence(
      withSpring(1.2, { damping: 8 }),
      withTiming(0.3, { duration: 800 })
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
        style,
      ]}
    />
  );
}

export function FirstVouchCelebration({
  visible,
  amountLamports,
  onDismiss,
}: FirstVouchCelebrationProps) {
  const backdropOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.5);
  const contentOpacity = useSharedValue(0);
  const amountScale = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 300);

      backdropOpacity.value = withTiming(1, { duration: 400 });
      contentScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
      contentOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
      amountScale.value = withDelay(600, withSpring(1, { damping: 10, stiffness: 120 }));
      badgeOpacity.value = withDelay(1000, withTiming(1, { duration: 500 }));
      glowScale.value = withDelay(400, withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1500 }),
          withTiming(0.9, { duration: 1500 })
        ),
        -1,
        true
      ));
    } else {
      backdropOpacity.value = 0;
      contentScale.value = 0.5;
      contentOpacity.value = 0;
      amountScale.value = 0;
      badgeOpacity.value = 0;
      glowScale.value = 0.8;
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: amountScale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  if (!visible) return null;

  // Generate particles in a burst pattern
  const particles = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const dist = 80 + Math.random() * 60;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      delay: Math.random() * 400,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        },
        backdropStyle,
      ]}
    >
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: "rgba(10,10,15,0.92)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Glow circle */}
        <Animated.View
          style={[
            glowStyle,
            {
              position: "absolute",
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: "rgba(232,168,56,0.08)",
            },
          ]}
        />

        {/* Particle burst */}
        <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
          {particles.map((p, i) => (
            <Particle key={i} delay={p.delay} x={p.x} y={p.y} />
          ))}
        </View>

        <Animated.View style={[contentStyle, { alignItems: "center", gap: 16 }]}>
          {/* Star icon */}
          <Text style={{ fontSize: 48 }}>{"\u2B50"}</Text>

          {/* Title */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: colors.primary,
              fontFamily: "SpaceGrotesk_700Bold",
              textAlign: "center",
            }}
          >
            Your First Earn!
          </Text>

          {/* SOL Amount */}
          <Animated.View style={amountStyle}>
            <View
              style={{
                backgroundColor: "rgba(232,168,56,0.12)",
                borderWidth: 1,
                borderColor: "rgba(232,168,56,0.3)",
                borderRadius: 20,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "800",
                  color: colors.primary,
                  fontFamily: "SpaceGrotesk_700Bold",
                  textAlign: "center",
                }}
              >
                +{formatSOL(amountLamports)} SOL
              </Text>
            </View>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View style={badgeStyle}>
            <Text
              style={{
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 24,
                paddingHorizontal: 32,
              }}
            >
              Someone believes in your photography.{"\n"}
              This SOL went directly to your wallet.
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: colors.textTertiary,
                marginTop: 24,
              }}
            >
              Tap anywhere to continue
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
