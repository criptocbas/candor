import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PublicKey } from "@solana/web3.js";

interface AuthState {
  walletAddress: string | null;
  displayName: string;
  isOnboarded: boolean;
  hasSeenFirstVouchCelebration: boolean;

  setWalletAddress: (address: string | null) => void;
  setDisplayName: (name: string) => void;
  setOnboarded: (value: boolean) => void;
  setFirstVouchCelebrationSeen: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      walletAddress: null,
      displayName: "Anon",
      isOnboarded: false,
      hasSeenFirstVouchCelebration: false,

      setWalletAddress: (address) => set({ walletAddress: address }),
      setDisplayName: (name) => set({ displayName: name }),
      setOnboarded: (value) => set({ isOnboarded: value }),
      setFirstVouchCelebrationSeen: () => set({ hasSeenFirstVouchCelebration: true }),
      reset: () =>
        set({
          walletAddress: null,
          displayName: "Anon",
          isOnboarded: false,
          hasSeenFirstVouchCelebration: false,
        }),
    }),
    {
      name: "candor-auth",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
