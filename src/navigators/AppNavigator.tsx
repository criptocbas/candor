import React, { useEffect } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";
import { useWallet } from "../hooks/useWallet";
import { useUnreadCount } from "../hooks/useNotifications";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationToast } from "../components/NotificationToast";
import { FirstVouchCelebration } from "../components/FirstVouchCelebration";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { CameraScreen } from "../screens/CameraScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { PhotoDetailScreen } from "../screens/PhotoDetailScreen";
import { UserProfileScreen } from "../screens/UserProfileScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { UserSearchScreen } from "../screens/UserSearchScreen";
import { colors } from "../theme/colors";
import { RootStackParamList, TabParamList } from "../types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const CandorDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  },
};

function TabIcon({ routeName, focused }: { routeName: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1 : 0.85);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.85, { damping: 15, stiffness: 150 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconMap: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
    Camera: { active: "camera", inactive: "camera-outline" },
    Feed: { active: "grid", inactive: "grid-outline" },
    Notifications: { active: "heart", inactive: "heart-outline" },
    Profile: { active: "person-circle", inactive: "person-circle-outline" },
  };

  const icons = iconMap[routeName] || { active: "ellipse", inactive: "ellipse-outline" };

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? icons.active : icons.inactive}
        size={22}
        color={focused ? colors.primary : colors.textTertiary}
      />
    </Animated.View>
  );
}

function NotificationsTabIcon({ focused }: { focused: boolean }) {
  const { walletAddress } = useWallet();
  const { data: unreadCount } = useUnreadCount(walletAddress);
  const scale = useSharedValue(focused ? 1 : 0.85);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.85, { damping: 15, stiffness: 150 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? "heart" : "heart-outline"}
        size={22}
        color={focused ? colors.primary : colors.textTertiary}
      />
      {(unreadCount ?? 0) > 0 && (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -6,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.error,
          }}
        />
      )}
    </Animated.View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarIcon: ({ focused }) =>
          route.name === "Notifications" ? (
            <NotificationsTabIcon focused={focused} />
          ) : (
            <TabIcon routeName={route.name} focused={focused} />
          ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          fontFamily: "SpaceGrotesk_600SemiBold",
        },
      })}
    >
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RealtimeOverlays() {
  const { walletAddress } = useWallet();
  const {
    toast,
    dismissToast,
    showFirstVouchCelebration,
    firstVouchAmount,
    dismissFirstVouchCelebration,
  } = useRealtimeNotifications(walletAddress);

  return (
    <>
      <NotificationToast
        visible={toast.visible}
        notification={toast.notification}
        onDismiss={dismissToast}
      />
      <FirstVouchCelebration
        visible={showFirstVouchCelebration}
        amountLamports={firstVouchAmount}
        onDismiss={dismissFirstVouchCelebration}
      />
    </>
  );
}

export function AppNavigator() {
  const isOnboarded = useAuthStore((state) => state.isOnboarded);

  return (
    <NavigationContainer theme={CandorDarkTheme}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isOnboarded ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="PhotoDetail"
                component={PhotoDetailScreen}
                options={{
                  headerShown: true,
                  headerTitle: "Photo",
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.textPrimary,
                  headerTitleStyle: {
                    fontWeight: "bold",
                    fontFamily: "SpaceGrotesk_700Bold",
                  },
                }}
              />
              <Stack.Screen
                name="UserProfile"
                component={UserProfileScreen}
                options={{
                  headerShown: true,
                  headerTitle: "Profile",
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.textPrimary,
                  headerTitleStyle: {
                    fontWeight: "bold",
                    fontFamily: "SpaceGrotesk_700Bold",
                  },
                }}
              />
              <Stack.Screen
                name="UserSearch"
                component={UserSearchScreen}
                options={{
                  headerShown: true,
                  headerTitle: "Search",
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.textPrimary,
                  headerTitleStyle: {
                    fontWeight: "bold",
                    fontFamily: "SpaceGrotesk_700Bold",
                  },
                }}
              />
            </>
          )}
        </Stack.Navigator>
        {isOnboarded && <RealtimeOverlays />}
      </View>
    </NavigationContainer>
  );
}
