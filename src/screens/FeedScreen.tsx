import React, { useCallback, useEffect, useState, useRef } from "react";
import { View, Text, RefreshControl, Dimensions, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PhotoCard } from "../components/PhotoCard";
import { FeedMap } from "../components/FeedMap";
import { AnimatedPressable } from "../components/ui/AnimatedPressable";
import { SkeletonLoader } from "../components/ui/SkeletonLoader";
import { VouchSuccessToast } from "../components/ui/VouchSuccessToast";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { useFeedPhotos, useFollowingFeedPhotos, useRefreshFeed, useUserVouchedPhotoIds } from "../hooks/usePhotos";
import { useVouch } from "../hooks/useVouch";
import { useWallet } from "../hooks/useWallet";
import { Photo, RootStackParamList } from "../types";
import { formatSOL } from "../utils/format";
import { colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SKELETON_WIDTH = SCREEN_WIDTH - 32;

function FeedSkeletonCard() {
  return (
    <View className="bg-surface rounded-2xl overflow-hidden mb-4">
      <SkeletonLoader
        width={SKELETON_WIDTH}
        height={SKELETON_WIDTH * 1.25}
        borderRadius={0}
      />
      <View className="px-4 pt-3 pb-4 gap-2.5">
        <View className="flex-row items-center justify-between">
          <SkeletonLoader width={120} height={16} borderRadius={8} />
          <SkeletonLoader width={40} height={12} borderRadius={6} />
        </View>
        <SkeletonLoader width="80%" height={14} borderRadius={8} />
        <SkeletonLoader width={100} height={32} borderRadius={16} />
      </View>
    </View>
  );
}

function FeedSkeleton() {
  return (
    <View className="px-4 pt-4">
      <FeedSkeletonCard />
      <FeedSkeletonCard />
      <FeedSkeletonCard />
    </View>
  );
}

type FeedView = "following" | "explore" | "map";

export function FeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: explorePhotos, isLoading: isLoadingExplore, isRefetching: isRefetchingExplore } = useFeedPhotos();
  const { walletAddress } = useWallet();
  const { data: followingPhotos, isLoading: isLoadingFollowing, isRefetching: isRefetchingFollowing } = useFollowingFeedPhotos(walletAddress);
  const refreshFeed = useRefreshFeed();
  const { vouch, isVouching, error, clearError, defaultAmount, lastSuccess, clearSuccess } = useVouch();
  const { data: vouchedPhotoIds } = useUserVouchedPhotoIds(walletAddress);
  const [vouchingPhotoId, setVouchingPhotoId] = useState<string | null>(null);
  const [feedView, setFeedView] = useState<FeedView>("explore");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [pendingVouchPhoto, setPendingVouchPhoto] = useState<Photo | null>(null);
  const [showDoubleTapHint, setShowDoubleTapHint] = useState(false);
  const hintChecked = useRef(false);

  useEffect(() => {
    if (hintChecked.current) return;
    hintChecked.current = true;
    AsyncStorage.getItem("candor-double-tap-hint-shown").then((val) => {
      if (!val) setShowDoubleTapHint(true);
    });
  }, []);

  const handleHintShown = useCallback(() => {
    setShowDoubleTapHint(false);
    AsyncStorage.setItem("candor-double-tap-hint-shown", "1");
  }, []);

  const activePhotos = feedView === "following" ? followingPhotos : explorePhotos;
  const activeIsLoading = feedView === "following" ? isLoadingFollowing : isLoadingExplore;
  const activeIsRefetching = feedView === "following" ? isRefetchingFollowing : isRefetchingExplore;

  useEffect(() => {
    if (lastSuccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccessToast(true);
    }
  }, [lastSuccess]);

  useEffect(() => {
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Vouch Failed", error);
      clearError();
    }
  }, [error, clearError]);

  const handleVouch = useCallback(
    (photo: Photo) => {
      setPendingVouchPhoto(photo);
    },
    []
  );

  const confirmVouch = useCallback(async () => {
    if (!pendingVouchPhoto) return;
    const photo = pendingVouchPhoto;
    setPendingVouchPhoto(null);
    setVouchingPhotoId(photo.id);
    await vouch(
      photo.id,
      photo.creator_wallet,
      photo.image_hash,
      defaultAmount
    );
    setVouchingPhotoId(null);
    refreshFeed();
  }, [pendingVouchPhoto, vouch, defaultAmount, refreshFeed]);

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => (
      <PhotoCard
        photo={item}
        index={index}
        onPress={() =>
          navigation.navigate("PhotoDetail", { photoId: item.id })
        }
        onVouch={() => handleVouch(item)}
        isVouching={vouchingPhotoId === item.id && isVouching}
        hasVouched={vouchedPhotoIds?.has(item.id) ?? false}
        isOwnPhoto={item.creator_wallet === walletAddress}
        vouchAmount={defaultAmount}
        showDoubleTapHint={index === 0 && showDoubleTapHint && item.creator_wallet !== walletAddress}
        onHintShown={handleHintShown}
      />
    ),
    [navigation, handleVouch, vouchingPhotoId, isVouching, defaultAmount, vouchedPhotoIds, walletAddress, showDoubleTapHint, handleHintShown]
  );

  if (activeIsLoading) {
    return (
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top }}
      >
        <FeedSkeleton />
      </View>
    );
  }

  const feedChips: { key: FeedView; label: string }[] = [
    { key: "following", label: "Following" },
    { key: "explore", label: "Explore" },
    { key: "map", label: "Map" },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* View toggle */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <AnimatedPressable
          haptic="light"
          onPress={() => navigation.navigate("UserSearch")}
          className="flex-1 mr-3"
        >
          <View className="flex-row items-center bg-surface rounded-xl px-3.5 py-2.5 gap-2">
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <Text className="text-text-tertiary text-sm">Search users...</Text>
          </View>
        </AnimatedPressable>
        <View
          className="flex-row rounded-full overflow-hidden"
          style={{ backgroundColor: colors.surface }}
        >
          {feedChips.map((chip) => (
            <AnimatedPressable
              key={chip.key}
              haptic="light"
              scaleValue={1}
              onPress={() => setFeedView(chip.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor:
                  feedView === chip.key
                    ? "rgba(232,168,56,0.18)"
                    : "transparent",
                borderRadius: 20,
                borderWidth: 1,
                borderColor:
                  feedView === chip.key
                    ? "rgba(232,168,56,0.3)"
                    : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color:
                    feedView === chip.key ? colors.primary : colors.textTertiary,
                }}
              >
                {chip.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>

      {/* Content */}
      {feedView === "map" ? (
        <FeedMap photos={explorePhotos ?? []} />
      ) : (
        <FlashList
          data={activePhotos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          extraData={vouchedPhotoIds}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={activeIsRefetching}
              onRefresh={refreshFeed}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={
            feedView === "following" ? (
              <View className="flex-1 items-center justify-center px-8 pt-32 gap-4">
                <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
                <Text className="text-text-primary text-lg font-display-semibold text-center">
                  Your feed is empty
                </Text>
                <Text className="text-text-tertiary text-sm text-center leading-5">
                  Follow creators to see their verified photos here.
                </Text>
                <AnimatedPressable
                  haptic="light"
                  onPress={() => setFeedView("explore")}
                  className="bg-primary rounded-full px-6 py-3 mt-2"
                >
                  <Text className="text-background font-display-semibold text-sm">
                    Discover Creators
                  </Text>
                </AnimatedPressable>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center px-8 pt-32 gap-4">
                <Ionicons name="camera-outline" size={40} color={colors.textTertiary} />
                <Text className="text-text-primary text-lg font-display-semibold text-center">
                  No photos yet
                </Text>
                <Text className="text-text-tertiary text-sm text-center leading-5">
                  Be the first to capture a verified moment.
                </Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}


      <ConfirmationModal
        visible={pendingVouchPhoto !== null}
        title="Vouch for this photo?"
        message={`This will send ${formatSOL(defaultAmount)} SOL to the creator.`}
        confirmLabel="Vouch"
        onConfirm={confirmVouch}
        onCancel={() => setPendingVouchPhoto(null)}
      />

      <VouchSuccessToast
        visible={showSuccessToast}
        amount={lastSuccess?.amount ?? 0}
        onDismiss={() => {
          setShowSuccessToast(false);
          clearSuccess();
        }}
      />
    </View>
  );
}
