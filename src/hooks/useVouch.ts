import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { PublicKey } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection } from "../utils/ConnectionProvider";
import { useWallet } from "./useWallet";
import { buildVouchTransaction } from "../services/anchor";
import { getPhotoRecordPDA } from "../services/solana";
import { supabase, ensureUserExists } from "../services/supabase";
import { hashToBytes } from "../utils/crypto";
import { formatSOL } from "../utils/format";

const DEFAULT_VOUCH_LAMPORTS = 5_000_000; // 0.005 SOL
const MAX_VOUCH_LAMPORTS = 5_000_000_000; // 5 SOL — must match program constant
const ESTIMATED_FEE = 15_000; // tx fee + rent buffer in lamports
const MAX_DB_RETRIES = 3;
const DB_RETRY_DELAY_MS = 1000;

export function useVouch() {
  const { connection } = useConnection();
  const { publicKey, walletAddress, signAndSendTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isVouching, setIsVouching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{ amount: number } | null>(null);

  const vouch = useCallback(
    async (
      photoId: string,
      creatorWallet: string,
      imageHash: string,
      amountLamports: number = DEFAULT_VOUCH_LAMPORTS
    ): Promise<string | null> => {
      if (!publicKey || !walletAddress) {
        setError("Wallet not connected");
        return null;
      }

      if (walletAddress === creatorWallet) {
        setError("Cannot vouch for your own photo");
        return null;
      }

      if (amountLamports <= 0) {
        setError("Vouch amount must be greater than zero");
        return null;
      }

      if (amountLamports > MAX_VOUCH_LAMPORTS) {
        setError("Vouch amount exceeds maximum of 5 SOL");
        return null;
      }

      setIsVouching(true);
      setError(null);

      try {
        // Pre-flight balance check
        const balance = await connection.getBalance(publicKey);
        const required = amountLamports + ESTIMATED_FEE;
        if (balance < required) {
          setError(
            `Insufficient SOL. You need ${formatSOL(required)} but only have ${formatSOL(balance)}.`
          );
          return null;
        }

        const creatorPubkey = new PublicKey(creatorWallet);
        const hashBytes = hashToBytes(imageHash);
        const [photoRecordPDA] = getPhotoRecordPDA(
          creatorPubkey,
          Buffer.from(hashBytes)
        );

        // Build, sign, send with one blockhash retry on expiry
        let txSignature!: string;
        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const { blockhash, lastValidBlockHeight } =
              await connection.getLatestBlockhash();

            const tx = buildVouchTransaction(
              publicKey,
              creatorPubkey,
              photoRecordPDA,
              amountLamports,
              blockhash
            );

            const slot = await connection.getSlot();
            txSignature = await signAndSendTransaction(tx, slot);

            await connection.confirmTransaction(
              {
                signature: txSignature,
                blockhash,
                lastValidBlockHeight,
              },
              "confirmed"
            );
            break;
          } catch (sendErr: any) {
            const msg = sendErr.message || "";
            const isBlockhashError =
              msg.includes("Blockhash not found") ||
              msg.includes("block height exceeded");
            if (isBlockhashError && attempt < maxAttempts) {
              console.warn("Blockhash expired, retrying with fresh blockhash...");
              continue;
            }
            throw sendErr;
          }
        }

        // Ensure voucher user row exists before inserting (so voucher_id FK gets linked)
        await ensureUserExists(walletAddress);

        // Record vouch in Supabase with retry logic.
        // The on-chain transfer already succeeded — if the DB write fails,
        // the user still has the tx signature as proof of payment.
        let dbWriteSucceeded = false;
        for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
          try {
            const { error: insertError } = await supabase.from("vouches").insert({
              photo_id: photoId,
              voucher_wallet: walletAddress,
              amount_lamports: amountLamports,
              tx_signature: txSignature,
            });
            if (insertError) throw insertError;
            // vouch_count and total_earned_lamports are updated automatically
            // by the auto_increment_vouch trigger on vouches INSERT.

            dbWriteSucceeded = true;
            break;
          } catch (dbErr: any) {
            console.error(`DB write attempt ${attempt}/${MAX_DB_RETRIES} failed:`, dbErr);
            if (attempt < MAX_DB_RETRIES) {
              await new Promise((r) => setTimeout(r, DB_RETRY_DELAY_MS * attempt));
            }
          }
        }

        if (!dbWriteSucceeded) {
          // SOL was transferred on-chain but DB record failed.
          // Show a warning with the tx signature so the user has proof.
          Alert.alert(
            "Vouch sent, but recording failed",
            `Your ${formatSOL(amountLamports)} SOL was sent on-chain (tx: ${txSignature.slice(0, 12)}...) but we couldn't save the record. It may appear after a refresh.`
          );
        }

        // Invalidate caches so all screens reflect the new vouch
        queryClient.invalidateQueries({ queryKey: ["vouches"] });
        queryClient.invalidateQueries({ queryKey: ["photos"] });

        setLastSuccess({ amount: amountLamports });

        return txSignature;
      } catch (err: any) {
        const msg = err.message || "";
        const isUserCancel =
          msg.includes("sign request declined") ||
          msg.includes("cancelled") ||
          msg.includes("rejected");
        if (!isUserCancel) {
          console.error("Vouch failed:", err);
          setError(msg || "Vouch failed");
        }
        return null;
      } finally {
        setIsVouching(false);
      }
    },
    [connection, publicKey, walletAddress, signAndSendTransaction, queryClient]
  );

  return {
    vouch,
    isVouching,
    error,
    clearError: () => setError(null),
    defaultAmount: DEFAULT_VOUCH_LAMPORTS,
    lastSuccess,
    clearSuccess: () => setLastSuccess(null),
  };
}
