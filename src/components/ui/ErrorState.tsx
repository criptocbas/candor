import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "./AnimatedPressable";
import { colors } from "../../theme/colors";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong. Check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-4">
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "rgba(207,102,121,0.1)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="cloud-offline-outline" size={28} color={colors.error} />
      </View>
      <Text className="text-text-primary text-lg font-display-semibold text-center">
        Couldn't load data
      </Text>
      <Text className="text-text-tertiary text-sm text-center leading-5">
        {message}
      </Text>
      {onRetry && (
        <AnimatedPressable
          haptic="light"
          onPress={onRetry}
          className="bg-primary rounded-full px-6 py-3 mt-2"
        >
          <Text className="text-background font-display-semibold text-sm">
            Retry
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
}
