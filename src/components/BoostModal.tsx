import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AnimatedPressable } from "./ui/AnimatedPressable";
import { colors } from "../theme/colors";
import { solToLamports, formatUSD } from "../utils/format";
import { useSolPrice } from "../hooks/useEarnings";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const PRESETS = [0.05, 0.1, 0.25, 0.5] as const;
const MIN_SOL = 0.01;
const MAX_SOL = 5;

interface BoostModalProps {
  visible: boolean;
  onClose: () => void;
  onBoost: (amountLamports: number) => void;
  isLoading: boolean;
  creatorName: string;
}

export function BoostModal({
  visible,
  onClose,
  onBoost,
  isLoading,
  creatorName,
}: BoostModalProps) {
  const { data: solPrice } = useSolPrice();
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (!visible) {
      setSelectedPreset(null);
      setUseCustom(false);
      setCustomValue("");
    }
  }, [visible]);

  if (!visible) return null;

  const parsedCustom = parseFloat(customValue);
  const customValid =
    !isNaN(parsedCustom) && parsedCustom >= MIN_SOL && parsedCustom <= MAX_SOL;

  const canConfirm = useCustom ? customValid : selectedPreset !== null;

  const handlePresetSelect = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPreset(amount);
    setUseCustom(false);
  };

  const handleToggleCustom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUseCustom(!useCustom);
    if (!useCustom) {
      setSelectedPreset(null);
    }
  };

  const handleConfirm = () => {
    if (!canConfirm || isLoading) return;
    const sol = useCustom ? parsedCustom : selectedPreset!;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBoost(solToLamports(sol));
  };

  return (
    <View style={StyleSheet.absoluteFill} className="items-center justify-center px-6">
      {/* Backdrop dismiss layer */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={isLoading ? undefined : onClose}
      >
        <View style={StyleSheet.absoluteFill} className="bg-black/80" />
      </Pressable>

      {/* Card */}
      <View className="bg-surface rounded-2xl p-6 w-full max-w-sm">
        {/* Header */}
        <Text className="text-text-primary font-display-bold text-lg mb-1">
          Boost
        </Text>
        <Text className="text-text-secondary text-sm mb-5">
          Send extra SOL to {creatorName}
        </Text>

        {/* Preset chips */}
        <View className="flex-row gap-2 mb-4">
          {PRESETS.map((amount) => {
            const isSelected = !useCustom && selectedPreset === amount;
            return (
              <AnimatedPressable
                key={amount}
                haptic="none"
                scaleValue={0.94}
                onPress={() => handlePresetSelect(amount)}
                disabled={isLoading}
                style={{ flex: 1 }}
              >
                <View
                  className={`items-center rounded-full py-2.5 border ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-surface-raised border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-display-semibold ${
                      isSelected ? "text-background" : "text-text-secondary"
                    }`}
                  >
                    {amount} SOL
                  </Text>
                  {solPrice ? (
                    <Text
                      style={{
                        fontSize: 9,
                        color: isSelected ? "rgba(10,10,15,0.6)" : colors.textTertiary,
                        marginTop: 1,
                      }}
                    >
                      {formatUSD(amount * LAMPORTS_PER_SOL, solPrice)}
                    </Text>
                  ) : null}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Custom amount toggle */}
        <AnimatedPressable
          haptic="none"
          onPress={handleToggleCustom}
          disabled={isLoading}
        >
          <Text
            className={`text-xs mb-3 ${
              useCustom ? "text-primary" : "text-text-tertiary"
            }`}
          >
            {useCustom ? "Use preset amount" : "Custom amount"}
          </Text>
        </AnimatedPressable>

        {/* Custom input */}
        {useCustom && (
          <View className="mb-4">
            <View className="flex-row items-center bg-surface-raised rounded-xl px-4 py-3 border border-border">
              <TextInput
                className="flex-1 text-text-primary text-base"
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={customValue}
                onChangeText={setCustomValue}
                editable={!isLoading}
                style={{ padding: 0 }}
              />
              <Text className="text-text-secondary text-sm ml-2">SOL</Text>
            </View>
            {customValue.length > 0 && !customValid && (
              <Text className="text-error text-xs mt-1.5 ml-1">
                Enter between {MIN_SOL} and {MAX_SOL} SOL
              </Text>
            )}
          </View>
        )}

        {/* Confirm button */}
        <AnimatedPressable
          haptic="none"
          scaleValue={0.96}
          onPress={handleConfirm}
          disabled={!canConfirm || isLoading}
        >
          <View
            className={`items-center rounded-full py-3.5 ${
              canConfirm ? "bg-primary" : "bg-surface-raised"
            }`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text
                className={`text-sm font-display-bold ${
                  canConfirm ? "text-background" : "text-text-tertiary"
                }`}
              >
                {canConfirm
                  ? `Send ${useCustom ? parsedCustom : selectedPreset} SOL${
                      solPrice
                        ? ` (${formatUSD(
                            (useCustom ? parsedCustom : selectedPreset!) * LAMPORTS_PER_SOL,
                            solPrice
                          )})`
                        : ""
                    }`
                  : "Select an amount"}
              </Text>
            )}
          </View>
        </AnimatedPressable>

        {/* Cancel */}
        {!isLoading && (
          <AnimatedPressable
            haptic="light"
            onPress={onClose}
            className="mt-3 items-center"
          >
            <Text className="text-text-tertiary text-xs">Cancel</Text>
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}
