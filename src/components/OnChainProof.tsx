import React, { useState, useCallback } from "react";
import { View, Text, Linking, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useConnection } from "../utils/ConnectionProvider";
import { AnimatedPressable } from "./ui/AnimatedPressable";
import {
  fetchPhotoRecordOnChain,
  getExplorerAddressUrl,
  OnChainPhotoRecord,
} from "../services/solana";
import { formatSOL, truncateAddress } from "../utils/format";
import { colors } from "../theme/colors";

interface OnChainProofProps {
  creatorWallet: string;
  imageHash: string;
  dbVouchCount: number;
  dbTotalEarned: number;
  verificationTx: string | null;
}

function MatchIndicator({ matches }: { matches: boolean }) {
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: matches
          ? "rgba(74,222,128,0.15)"
          : "rgba(239,68,68,0.15)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={matches ? "checkmark" : "close"}
        size={12}
        color={matches ? colors.success : colors.error}
      />
    </View>
  );
}

function ProofField({
  label,
  onChainValue,
  dbValue,
  matches,
  index,
  isLast = false,
}: {
  label: string;
  onChainValue: string;
  dbValue: string;
  matches: boolean;
  index: number;
  isLast?: boolean;
}) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(12);

  React.useEffect(() => {
    opacity.value = withDelay(index * 100, withTiming(1, { duration: 300 }));
    translateX.value = withDelay(
      index * 100,
      withSpring(0, { damping: 18, stiffness: 140 })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={style}>
      <View
        style={{
          paddingVertical: 10,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
            {label}
          </Text>
          <MatchIndicator matches={matches} />
        </View>
        <Text
          style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 2 }}
          numberOfLines={1}
        >
          On-chain: {onChainValue}
        </Text>
        <Text
          style={{ color: colors.textTertiary, fontSize: 11 }}
          numberOfLines={1}
        >
          Database: {dbValue}
        </Text>
      </View>
    </Animated.View>
  );
}

export function OnChainProof({
  creatorWallet,
  imageHash,
  dbVouchCount,
  dbTotalEarned,
  verificationTx,
}: OnChainProofProps) {
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [record, setRecord] = useState<OnChainPhotoRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasVerified, setHasVerified] = useState(false);

  const containerScale = useSharedValue(1);
  const resultOpacity = useSharedValue(0);
  const resultTranslateY = useSharedValue(8);

  const handleVerify = useCallback(async () => {
    if (!verificationTx) {
      setError("No on-chain verification for this photo");
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = await fetchPhotoRecordOnChain(
        connection,
        creatorWallet,
        imageHash
      );

      if (!data) {
        setError("PDA not found on-chain");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setRecord(data);
      setHasVerified(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate results in
      resultOpacity.value = withTiming(1, { duration: 400 });
      resultTranslateY.value = withSpring(0, { damping: 16, stiffness: 120 });
    } catch (err: any) {
      console.error("On-chain verification failed:", err);
      setError(err.message || "Failed to fetch on-chain data");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [connection, creatorWallet, imageHash, verificationTx]);

  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ translateY: resultTranslateY.value }],
  }));

  // Check matches
  const hashMatches = record ? record.imageHash === imageHash : false;
  const creatorMatches = record ? record.creator === creatorWallet : false;
  const vouchCountMatches = record
    ? record.vouchCount === dbVouchCount
    : false;
  const earningsMatch = record ? record.totalEarned === dbTotalEarned : false;
  const allMatch =
    hashMatches && creatorMatches && vouchCountMatches && earningsMatch;

  if (!verificationTx) return null;

  return (
    <View style={{ gap: 12 }}>
      {/* Verify button or result header */}
      {!hasVerified ? (
        <AnimatedPressable
          haptic="none"
          scaleValue={0.96}
          onPress={handleVerify}
          disabled={isLoading}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(74,222,128,0.08)",
              borderWidth: 1,
              borderColor: "rgba(74,222,128,0.2)",
              borderRadius: 16,
              paddingVertical: 14,
              gap: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text
                  style={{
                    color: colors.success,
                    fontSize: 14,
                    fontWeight: "700",
                    fontFamily: "SpaceGrotesk_700Bold",
                  }}
                >
                  Verify On-Chain
                </Text>
              </>
            )}
          </View>
        </AnimatedPressable>
      ) : (
        <Animated.View style={resultStyle}>
          {/* Result header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Ionicons
              name={allMatch ? "shield-checkmark" : "warning"}
              size={18}
              color={allMatch ? colors.success : colors.error}
            />
            <Text
              style={{
                color: allMatch ? colors.success : colors.error,
                fontSize: 13,
                fontWeight: "700",
                fontFamily: "SpaceGrotesk_700Bold",
              }}
            >
              {allMatch
                ? "ON-CHAIN DATA VERIFIED"
                : "DATA MISMATCH DETECTED"}
            </Text>
          </View>

          {/* PDA Address */}
          {record && (
            <AnimatedPressable
              haptic="light"
              onPress={() =>
                Linking.openURL(getExplorerAddressUrl(record.pdaAddress))
              }
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 11 }}>
                  PDA: {truncateAddress(record.pdaAddress, 8)}
                </Text>
                <Ionicons name="open-outline" size={10} color={colors.primary} />
              </View>
            </AnimatedPressable>
          )}

          {/* Comparison fields */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: allMatch
                ? "rgba(74,222,128,0.15)"
                : "rgba(239,68,68,0.15)",
            }}
          >
            <ProofField
              label="Image Hash"
              onChainValue={record ? record.imageHash.slice(0, 16) + "..." : ""}
              dbValue={imageHash.slice(0, 16) + "..."}
              matches={hashMatches}
              index={0}
            />
            <ProofField
              label="Creator"
              onChainValue={
                record ? truncateAddress(record.creator, 6) : ""
              }
              dbValue={truncateAddress(creatorWallet, 6)}
              matches={creatorMatches}
              index={1}
            />
            <ProofField
              label="Vouches"
              onChainValue={record ? `${record.vouchCount}` : ""}
              dbValue={`${dbVouchCount}`}
              matches={vouchCountMatches}
              index={2}
            />
            <ProofField
              label="Total Earned"
              onChainValue={record ? formatSOL(record.totalEarned) : ""}
              dbValue={formatSOL(dbTotalEarned)}
              matches={earningsMatch}
              index={3}
              isLast
            />
          </View>
        </Animated.View>
      )}

      {/* Error */}
      {error && (
        <Text
          style={{
            color: colors.error,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
