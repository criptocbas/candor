import { useCallback, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAuthStore } from "../stores/authStore";
import { useAuthorization } from "../utils/useAuthorization";
import { useMobileWallet } from "../utils/useMobileWallet";
import { supabase } from "../services/supabase";

export function useWallet() {
  const { selectedAccount } = useAuthorization();
  const { connect, disconnect, signAndSendTransaction, signMessage } =
    useMobileWallet();
  const {
    setWalletAddress,
    setOnboarded,
    setDisplayName,
    walletAddress: storedWalletAddress,
    displayName,
    isOnboarded,
    reset,
  } = useAuthStore();

  // Derive wallet address: prefer live MWA session, fall back to persisted
  const walletAddress =
    selectedAccount?.publicKey?.toBase58() ?? storedWalletAddress;

  const publicKey = useMemo(() => {
    if (selectedAccount?.publicKey) return selectedAccount.publicKey;
    if (storedWalletAddress) {
      try {
        return new PublicKey(storedWalletAddress);
      } catch {
        return null;
      }
    }
    return null;
  }, [selectedAccount, storedWalletAddress]);

  const connectWallet = useCallback(async () => {
    try {
      const account = await connect();
      const address = account.publicKey.toBase58();
      setWalletAddress(address);

      // Ensure user exists in Supabase
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("wallet_address", address)
        .single();

      if (!existingUser) {
        await supabase.from("users").insert({
          wallet_address: address,
          display_name: "Anon",
        });
        // New user — stay on setup screen for username pick
      } else {
        // Returning user — skip onboarding, go straight to the app
        setDisplayName(existingUser.display_name);
        setOnboarded(true);
      }

      return account;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }, [connect, setWalletAddress, setDisplayName, setOnboarded]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      reset();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      throw error;
    }
  }, [disconnect, reset]);

  return {
    publicKey,
    walletAddress,
    connected: !!walletAddress,
    displayName,
    isOnboarded,
    connectWallet,
    disconnectWallet,
    signAndSendTransaction,
    signMessage,
  };
}
