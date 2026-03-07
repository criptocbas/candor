import React, { useEffect } from "react";
import { Text, View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Avatar } from "./ui/Avatar";
import { formatSOL, formatUSD } from "../utils/format";
import { useSolPrice } from "../hooks/useEarnings";
import { colors } from "../theme/colors";
import { Notification, RootStackParamList } from "../types";

interface NotificationToastProps {
  visible: boolean;
  notification: Notification | null;
  onDismiss: () => void;
}

export function NotificationToast({
  visible,
  notification,
  onDismiss,
}: NotificationToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: solPrice } = useSolPrice();

  useEffect(() => {
    if (visible && notification) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 140 });
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(onDismiss, 300);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      translateY.value = -120;
      opacity.value = 0;
    }
  }, [visible, notification]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible || !notification) return null;

  const actorName =
    notification.actor?.display_name ||
    notification.actor_wallet.slice(0, 4) + "..." + notification.actor_wallet.slice(-4);

  const handlePress = () => {
    onDismiss();
    if (notification.type === "vouch" && notification.photo_id) {
      navigation.navigate("PhotoDetail", { photoId: notification.photo_id });
    } else if (notification.type === "follow") {
      navigation.navigate("UserProfile", {
        walletAddress: notification.actor_wallet,
      });
    }
  };

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    >
      <Pressable onPress={handlePress}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: notification.type === "vouch"
              ? "rgba(232,168,56,0.3)"
              : "rgba(74,222,128,0.3)",
            shadowColor: notification.type === "vouch" ? colors.primary : colors.success,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Avatar
            uri={notification.actor?.avatar_url}
            name={actorName}
            size="sm"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}
              numberOfLines={1}
            >
              {actorName}
            </Text>
            <Text
              style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}
              numberOfLines={1}
            >
              {notification.type === "vouch" ? (
                <>
                  {"Vouched "}
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>
                    {formatSOL(notification.amount_lamports ?? 0)}
                  </Text>
                  {solPrice ? (
                    <Text style={{ color: colors.textTertiary }}>
                      {" "}({formatUSD(notification.amount_lamports ?? 0, solPrice)})
                    </Text>
                  ) : null}
                  {" on your photo"}
                </>
              ) : (
                "Started following you"
              )}
            </Text>
          </View>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: notification.type === "vouch" ? colors.primary : colors.success,
            }}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}
