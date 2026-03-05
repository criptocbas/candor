// Polyfills — must be first
import "./src/polyfills";
import "./global.css";

import React, { useCallback } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { ConnectionProvider } from "./src/utils/ConnectionProvider";
import { ClusterProvider } from "./src/components/cluster/cluster-data-access";
import { AppNavigator } from "./src/navigators/AppNavigator";
import { OfflineBanner } from "./src/components/ui/OfflineBanner";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <QueryClientProvider client={queryClient}>
          <ClusterProvider>
            <ConnectionProvider config={{ commitment: "confirmed" }}>
              <SafeAreaProvider>
                <AppNavigator />
                <OfflineBanner />
              </SafeAreaProvider>
            </ConnectionProvider>
          </ClusterProvider>
        </QueryClientProvider>
      </View>
    </ErrorBoundary>
  );
}
