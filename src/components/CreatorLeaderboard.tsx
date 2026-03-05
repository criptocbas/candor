import React, { useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./ui/Avatar";
import { AnimatedPressable } from "./ui/AnimatedPressable";
import { useTopCreators } from "../hooks/useEarnings";
import { truncateAddress } from "../utils/format";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../types";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

function formatCompactSOL(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol < 0.01) return `${sol.toFixed(4)}`;
  if (sol < 1) return `${sol.toFixed(3)}`;
  if (sol < 100) return `${sol.toFixed(2)}`;
  return `${Math.floor(sol)}`;
}

const RANK_COLORS = ["#E8A838", "#C0C0C0", "#CD7F32"] as const;

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: isTop3
          ? RANK_COLORS[rank - 1]
          : colors.surfaceRaised,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color: isTop3 ? colors.background : colors.textTertiary,
          fontFamily: "SpaceGrotesk_700Bold",
        }}
      >
        {rank}
      </Text>
    </View>
  );
}

function CreatorCard({
  rank,
  displayName,
  avatarUrl,
  walletAddress,
  totalEarned,
  vouchCount,
  index,
}: {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  walletAddress: string;
  totalEarned: number;
  vouchCount: number;
  index: number;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 80;
    translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 120 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const isTop3 = rank <= 3;

  return (
    <Animated.View style={cardStyle}>
      <AnimatedPressable
        haptic="light"
        scaleValue={0.96}
        onPress={() => navigation.navigate("UserProfile", { walletAddress })}
      >
        <View
          style={{
            width: 140,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: isTop3
              ? "rgba(232,168,56,0.2)"
              : colors.border,
            gap: 10,
            ...(isTop3 && rank === 1
              ? {
                  shadowColor: "#E8A838",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 4,
                }
              : {}),
          }}
        >
          {/* Rank + Avatar row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <RankBadge rank={rank} />
            <Avatar uri={avatarUrl} name={displayName} size="sm" />
          </View>

          {/* Name */}
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 13,
              fontFamily: "SpaceGrotesk_600SemiBold",
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          {/* SOL earned */}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Text
              style={{
                color: colors.primary,
                fontSize: 18,
                fontFamily: "SpaceGrotesk_700Bold",
                fontWeight: "700",
              }}
            >
              {formatCompactSOL(totalEarned)}
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontSize: 11,
                fontFamily: "SpaceGrotesk_600SemiBold",
                opacity: 0.7,
              }}
            >
              SOL
            </Text>
          </View>

          {/* Vouch count */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="heart" size={11} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
              {vouchCount} {vouchCount === 1 ? "vouch" : "vouches"}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function CreatorLeaderboard() {
  const { data: creators, isLoading } = useTopCreators(10);

  // Don't render anything if no data or loading
  if (isLoading || !creators || creators.length === 0) return null;

  return (
    <View style={{ paddingBottom: 8 }}>
      {/* Section header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 10,
          gap: 6,
        }}
      >
        <Ionicons name="trophy" size={16} color={colors.primary} />
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 15,
            fontFamily: "SpaceGrotesk_700Bold",
            fontWeight: "700",
          }}
        >
          Top Creators
        </Text>
        <View
          style={{
            backgroundColor: "rgba(232,168,56,0.15)",
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 2,
            marginLeft: 4,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 10,
              fontFamily: "SpaceGrotesk_600SemiBold",
              fontWeight: "600",
            }}
          >
            LIVE
          </Text>
        </View>
      </View>

      {/* Horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 10,
        }}
      >
        {creators.map((creator, index) => (
          <CreatorCard
            key={creator.wallet_address}
            rank={index + 1}
            displayName={creator.display_name}
            avatarUrl={creator.avatar_url}
            walletAddress={creator.wallet_address}
            totalEarned={creator.total_earned}
            vouchCount={creator.vouch_count}
            index={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}
