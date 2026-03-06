import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useConnection } from "../utils/ConnectionProvider";
import { useWallet } from "./useWallet";
import { buildVerifyPhotoTransaction } from "../services/anchor";
import { uploadImage, CaptureMetadata } from "../services/verification";
import { supabase, ensureUserExists } from "../services/supabase";
import { PROGRAM_ID } from "../services/solana";
import { PhotoUploadData } from "../types";

const MAX_DB_RETRIES = 3;
const DB_RETRY_DELAY_MS = 1000;

// Program is deployed when ID is not the placeholder
const PROGRAM_DEPLOYED =
  PROGRAM_ID.toBase58() !== "11111111111111111111111111111111";

export function useVerification() {
  const { connection } = useConnection();
  const { publicKey, walletAddress, signAndSendTransaction } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyAndUpload = useCallback(
    async (
      metadata: CaptureMetadata,
      caption: string
    ): Promise<PhotoUploadData | null> => {
      if (!publicKey || !walletAddress) {
        setError("Wallet not connected");
        return null;
      }

      setIsVerifying(true);
      setError(null);

      try {
        let txSignature: string | null = null;

        // On-chain verification (only if program is deployed)
        // Includes one retry on blockhash expiry
        if (PROGRAM_DEPLOYED) {
          const maxAttempts = 2;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const { blockhash, lastValidBlockHeight } =
                await connection.getLatestBlockhash();

              const tx = buildVerifyPhotoTransaction(
                publicKey,
                metadata.imageHashBytes,
                metadata.latitude ?? 0,
                metadata.longitude ?? 0,
                metadata.timestamp,
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
        }

        // Upload image to Supabase Storage
        const imageUrl = await uploadImage(
          supabase,
          metadata.imageUri,
          walletAddress
        );

        // Ensure user row exists before inserting (so creator_id FK gets linked)
        await ensureUserExists(walletAddress);

        // Insert photo record in Supabase with retry logic.
        // The on-chain verification and image upload already succeeded —
        // if the DB write fails, the user still has the tx signature as proof.
        let dbWriteSucceeded = false;
        for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
          try {
            const { error: insertError } = await supabase.from("photos").insert({
              creator_wallet: walletAddress,
              image_url: imageUrl,
              image_hash: metadata.imageHash,
              caption: caption || null,
              latitude: metadata.latitude,
              longitude: metadata.longitude,
              location_accuracy: metadata.locationAccuracy,
              is_location_mocked: metadata.isMocked,
              verification_tx: txSignature,
            });
            if (insertError) throw insertError;
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
          Alert.alert(
            "Photo verified, but save failed",
            `Your photo was verified on-chain${txSignature ? ` (tx: ${txSignature.slice(0, 12)}...)` : ""} but we couldn't save the record. It may appear after a refresh.`
          );
        }

        return {
          imageUri: metadata.imageUri,
          imageHash: metadata.imageHash,
          caption,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
          locationAccuracy: metadata.locationAccuracy,
          verificationTx: txSignature ?? "",
          creatorWallet: walletAddress,
        };
      } catch (err: any) {
        console.error("Verification failed:", err);
        setError(err.message || "Verification failed");
        return null;
      } finally {
        setIsVerifying(false);
      }
    },
    [connection, publicKey, walletAddress, signAndSendTransaction]
  );

  return {
    verifyAndUpload,
    isVerifying,
    error,
    clearError: () => setError(null),
  };
}
