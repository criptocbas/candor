import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatSOL, formatUSD } from "../../utils/format";
import { useSolPrice } from "../../hooks/useEarnings";
import { colors } from "../../theme/colors";

interface VouchSuccessToastProps {
  visible: boolean;
  amount: number;
  onDismiss: () => void;
}

export function VouchSuccessToast({
  visible,
  amount,
  onDismiss,
}: VouchSuccessToastProps) {
  const insets = useSafeAreaInsets();
  const { data: solPrice } = useSolPrice();
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(onDismiss, 300);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      translateY.value = 80;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom: insets.bottom + 24,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 999,
          pointerEvents: "none",
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(232,168,56,0.3)",
        }}
      >
        <Text
          style={{
            color: colors.primary,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {"✓ Vouched · "}
        </Text>
        <Text
          style={{
            color: colors.primary,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {formatSOL(amount)}
          {solPrice ? (
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 12,
                fontWeight: "400",
              }}
            >
              {" "}({formatUSD(amount, solPrice)})
            </Text>
          ) : null}
        </Text>
      </View>
    </Animated.View>
  );
}
