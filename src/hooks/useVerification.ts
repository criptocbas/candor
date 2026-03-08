import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useConnection } from "../utils/ConnectionProvider";
import { useWallet } from "./useWallet";
import { buildVerifyPhotoTransaction } from "../services/anchor";
import { uploadImage, CaptureMetadata } from "../services/verification";
import { uploadNftMetadata } from "../services/cnft";
import { supabase, ensureUserExists } from "../services/supabase";
import { PROGRAM_ID } from "../services/solana";
import { PhotoUploadData } from "../types";

const MAX_DB_RETRIES = 3;
const DB_RETRY_DELAY_MS = 1000;

// Program is deployed when ID is not the placeholder
const PROGRAM_DEPLOYED =
  PROGRAM_ID.toBase58() !== "11111111111111111111111111111111";

// Verification steps for the animation UI
// 0 = hashing, 1 = signing, 2 = broadcasting, 3 = confirmed
export type VerificationStep = 0 | 1 | 2 | 3 | -1;

export function useVerification() {
  const { connection } = useConnection();
  const { publicKey, walletAddress, signAndSendTransaction } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>(-1);

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
      setVerificationStep(0); // Step 0: Hashing (already done, but visual step)

      try {
        let txSignature: string | null = null;

        // Upload image early — we need the URL for cNFT metadata
        // This runs during the "hashing" animation, so no extra perceived delay
        const imageUrl = await uploadImage(
          supabase,
          metadata.imageUri,
          walletAddress
        );

        // Upload NFT metadata JSON (for cNFT mint instruction)
        let cnftMetadataUri: string | undefined;
        try {
          cnftMetadataUri = await uploadNftMetadata({
            imageUrl,
            imageHash: metadata.imageHash,
            caption,
            creatorWallet: walletAddress,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            timestamp: metadata.timestamp,
          });
        } catch (metaErr) {
          // Non-critical: if metadata upload fails, we skip cNFT minting
          console.error("NFT metadata upload failed (continuing without cNFT):", metaErr);
        }

        // On-chain verification (only if program is deployed)
        if (PROGRAM_DEPLOYED) {
          // Step 1: Signing — building and requesting wallet signature
          await new Promise((r) => setTimeout(r, 800)); // Let hash animation play
          setVerificationStep(1);

          let includeCnft = !!cnftMetadataUri;
          const maxAttempts = 3;
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
                blockhash,
                includeCnft ? cnftMetadataUri : undefined,
                includeCnft ? metadata.imageHash : undefined
              );

              const slot = await connection.getSlot();

              // Step 2: Broadcasting — sending to network
              setVerificationStep(2);
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
              // User explicitly declined — don't retry
              const isUserCancel =
                msg.includes("sign request declined") ||
                msg.includes("cancelled") ||
                msg.includes("rejected");
              if (isUserCancel) throw sendErr;

              const isBlockhashError =
                msg.includes("Blockhash not found") ||
                msg.includes("block height exceeded");
              if (isBlockhashError && attempt < maxAttempts) {
                console.warn("Blockhash expired, retrying with fresh blockhash...");
                continue;
              }
              // If cNFT mint may have caused the failure, retry without it
              if (includeCnft && attempt < maxAttempts) {
                console.warn("Transaction failed with cNFT mint, retrying verify-only:", msg);
                includeCnft = false;
                setVerificationStep(1);
                continue;
              }
              throw sendErr;
            }
          }
        } else {
          // Simulate steps when program not deployed
          await new Promise((r) => setTimeout(r, 600));
          setVerificationStep(1);
          await new Promise((r) => setTimeout(r, 600));
          setVerificationStep(2);
          await new Promise((r) => setTimeout(r, 600));
        }

        // Step 3: Confirmed on-chain
        setVerificationStep(3);

        // Ensure user row exists before inserting (so creator_id FK gets linked)
        await ensureUserExists(walletAddress);

        // Insert photo record in Supabase with retry logic.
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
        setVerificationStep(-1);
        return null;
      } finally {
        setIsVerifying(false);
      }
    },
    [connection, publicKey, walletAddress, signAndSendTransaction]
  );

  const resetStep = useCallback(() => setVerificationStep(-1), []);

  return {
    verifyAndUpload,
    isVerifying,
    error,
    clearError: () => setError(null),
    verificationStep,
    resetStep,
  };
}
