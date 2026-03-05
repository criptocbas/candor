import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useUserSearch } from "../hooks/useUserSearch";
import { Avatar } from "../components/ui/Avatar";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { truncateAddress } from "../utils/format";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { User, RootStackParamList } from "../types";

export function UserSearchScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState("");
  const { data: results, isLoading, isError } = useUserSearch(query);
  const inputRef = useRef<TextInput>(null);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const renderItem = ({ item }: { item: User }) => (
    <AnimatedPressable
      haptic="light"
      onPress={() =>
        navigation.navigate("UserProfile", { walletAddress: item.wallet_address })
      }
    >
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Avatar
          uri={item.avatar_url}
          name={item.display_name}
          size="md"
        />
        <View className="flex-1">
          <Text className="text-text-primary text-sm font-display-semibold">
            {item.display_name}
          </Text>
          <Text className="text-text-tertiary text-xs">
            {truncateAddress(item.wallet_address)}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Search input */}
      <View className="px-4 py-3">
        <View
          className="flex-row items-center rounded-xl px-3 py-2.5"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by display name..."
            placeholderTextColor={colors.textTertiary}
            className="flex-1 text-text-primary text-base"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => (
          <View className="border-b border-border mx-4" />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-32 gap-4">
            {query.length < 2 ? (
              <>
                <Text className="text-text-primary text-lg font-display-semibold text-center">
                  Search for creators
                </Text>
                <Text className="text-text-tertiary text-sm text-center leading-5">
                  Search for creators by name to discover and follow them.
                </Text>
              </>
            ) : isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isError ? (
              <>
                <Ionicons name="cloud-offline-outline" size={28} color={colors.error} />
                <Text className="text-text-primary text-lg font-display-semibold text-center">
                  Search failed
                </Text>
                <Text className="text-text-tertiary text-sm text-center leading-5">
                  Check your connection and try again.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-text-primary text-lg font-display-semibold text-center">
                  No users found
                </Text>
                <Text className="text-text-tertiary text-sm text-center leading-5">
                  Try a different search term.
                </Text>
              </>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
