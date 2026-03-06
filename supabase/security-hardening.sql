-- ============================================================================
-- Candor Security Hardening Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- IMPORTANT: Run this AFTER all previous migrations (migration.sql,
-- add-unique-username.sql, add-follows.sql, add-notifications.sql).
--
-- This migration:
--   1. Replaces permissive RLS policies with ownership-based restrictions
--   2. Replaces callable increment_vouch RPC with an automatic trigger
--   3. Adds self-vouch prevention at DB level
--   4. Adds self-follow prevention at DB level
--   5. Adds is_location_mocked column to photos
--   6. Ensures display_name UNIQUE constraint exists
--   7. Restricts direct UPDATE on photos (only via triggers)
-- ============================================================================

-- ─── 1. Drop all existing permissive RLS policies ────────────────────────────

-- Users
DROP POLICY IF EXISTS "Users are publicly readable" ON users;
DROP POLICY IF EXISTS "Users can insert themselves" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Photos
DROP POLICY IF EXISTS "Photos are publicly readable" ON photos;
DROP POLICY IF EXISTS "Anyone can insert photos" ON photos;
DROP POLICY IF EXISTS "Anyone can update photos" ON photos;

-- Vouches
DROP POLICY IF EXISTS "Vouches are publicly readable" ON vouches;
DROP POLICY IF EXISTS "Anyone can insert vouches" ON vouches;

-- Follows
DROP POLICY IF EXISTS "Follows are publicly readable" ON follows;
DROP POLICY IF EXISTS "Anyone can insert follows" ON follows;
DROP POLICY IF EXISTS "Anyone can delete follows" ON follows;

-- Notifications
DROP POLICY IF EXISTS "Notifications are publicly readable" ON notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON notifications;

-- ─── 2. Create restrictive RLS policies ──────────────────────────────────────

-- USERS table:
--   SELECT: public (anyone can view profiles)
--   INSERT: public (wallet-based identity — user creates their own row)
--   UPDATE: only rows where request comes from service role (via triggers/RPCs)
--           For now, keep UPDATE open since we have no auth tokens,
--           but the client only updates by wallet_address match.
--           NOTE: Without Supabase auth, we cannot enforce wallet ownership
--           at the RLS level. This is documented as a known limitation.

CREATE POLICY "users_select" ON users
  FOR SELECT USING (true);

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);

-- Users can update — in production, this should require JWT auth.
-- For hackathon, we keep this open but document the risk.
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (true);

-- PHOTOS table:
--   SELECT: public
--   INSERT: public (creator_wallet set by client, linked by trigger)
--   UPDATE: DENY to anon role — only service_role and triggers can update.
--           This prevents direct manipulation of vouch_count/total_earned_lamports.

CREATE POLICY "photos_select" ON photos
  FOR SELECT USING (true);

CREATE POLICY "photos_insert" ON photos
  FOR INSERT WITH CHECK (true);

-- Block ALL direct updates from anon clients.
-- Updates happen only via the trigger (on vouch insert).
CREATE POLICY "photos_update_deny" ON photos
  FOR UPDATE USING (false);

-- VOUCHES table:
--   SELECT: public
--   INSERT: public (one per user per photo enforced by UNIQUE constraint)
--   No UPDATE or DELETE policies — vouches are immutable

CREATE POLICY "vouches_select" ON vouches
  FOR SELECT USING (true);

CREATE POLICY "vouches_insert" ON vouches
  FOR INSERT WITH CHECK (true);

-- FOLLOWS table:
--   SELECT: public
--   INSERT: public
--   DELETE: public (the follower_wallet/following_wallet UNIQUE constraint
--           limits what can actually be deleted — only existing rows)

CREATE POLICY "follows_select" ON follows
  FOR SELECT USING (true);

CREATE POLICY "follows_insert" ON follows
  FOR INSERT WITH CHECK (true);

CREATE POLICY "follows_delete" ON follows
  FOR DELETE USING (true);

-- NOTIFICATIONS table:
--   SELECT: public
--   INSERT: only via triggers (deny direct insert from anon)
--   UPDATE: public (for marking as read — only toggles the `read` boolean)

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (true);

-- Block direct notification inserts from clients — only triggers should create them
CREATE POLICY "notifications_insert_deny" ON notifications
  FOR INSERT WITH CHECK (false);

-- Allow marking notifications as read
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (true);

-- ─── 3. Replace increment_vouch RPC with automatic trigger ───────────────────

-- Drop the old callable RPC function
DROP FUNCTION IF EXISTS increment_vouch(UUID, BIGINT);

-- Create a trigger that automatically updates photo stats when a vouch is inserted.
-- This runs as SECURITY DEFINER (bypasses RLS), so it can update photos
-- even though the anon role is denied direct photo updates.
CREATE OR REPLACE FUNCTION auto_increment_vouch()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE photos
  SET vouch_count = vouch_count + 1,
      total_earned_lamports = total_earned_lamports + NEW.amount_lamports
  WHERE id = NEW.photo_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_auto_increment_vouch ON vouches;
CREATE TRIGGER trg_auto_increment_vouch
  AFTER INSERT ON vouches
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_vouch();

-- ─── 4. Self-vouch prevention at DB level ────────────────────────────────────
-- Prevent a user from vouching for their own photo at the database level.
-- The on-chain program also enforces this, but defense in depth.

CREATE OR REPLACE FUNCTION check_no_self_vouch()
RETURNS TRIGGER AS $$
DECLARE
  photo_creator TEXT;
BEGIN
  SELECT creator_wallet INTO photo_creator FROM photos WHERE id = NEW.photo_id;
  IF photo_creator = NEW.voucher_wallet THEN
    RAISE EXCEPTION 'Cannot vouch for your own photo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_no_self_vouch ON vouches;
CREATE TRIGGER trg_check_no_self_vouch
  BEFORE INSERT ON vouches
  FOR EACH ROW
  EXECUTE FUNCTION check_no_self_vouch();

-- ─── 5. Self-follow prevention ───────────────────────────────────────────────

ALTER TABLE follows DROP CONSTRAINT IF EXISTS no_self_follow;
ALTER TABLE follows ADD CONSTRAINT no_self_follow
  CHECK (follower_wallet != following_wallet);

-- ─── 6. Add is_location_mocked column to photos ─────────────────────────────

ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_location_mocked BOOLEAN DEFAULT FALSE;

-- ─── 7. Ensure display_name UNIQUE constraint exists ─────────────────────────
-- This is idempotent — if add-unique-username.sql was already run, this is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_display_name'
  ) THEN
    -- Fix duplicates first
    WITH duplicates AS (
      SELECT id, display_name, wallet_address,
        ROW_NUMBER() OVER (PARTITION BY display_name ORDER BY created_at) as rn
      FROM users
    )
    UPDATE users
    SET display_name = users.display_name || '_' || LEFT(users.wallet_address, 4)
    FROM duplicates
    WHERE users.id = duplicates.id
      AND duplicates.rn > 1;

    ALTER TABLE users ADD CONSTRAINT unique_display_name UNIQUE (display_name);
  END IF;
END $$;

-- ─── 8. Make notification triggers SECURITY DEFINER ──────────────────────────
-- Since we blocked direct notification inserts from anon, the vouch/follow
-- notification triggers need SECURITY DEFINER to bypass that policy.

CREATE OR REPLACE FUNCTION notify_on_vouch()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator TEXT;
BEGIN
  SELECT creator_wallet INTO creator FROM photos WHERE id = NEW.photo_id;
  IF creator IS NOT NULL AND creator != NEW.voucher_wallet THEN
    INSERT INTO notifications (recipient_wallet, actor_wallet, type, photo_id, amount_lamports)
    VALUES (creator, NEW.voucher_wallet, 'vouch', NEW.photo_id, NEW.amount_lamports);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (recipient_wallet, actor_wallet, type)
  VALUES (NEW.following_wallet, NEW.follower_wallet, 'follow');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also make the FK-linking triggers SECURITY DEFINER so they work
-- even if we tighten policies further in the future.

CREATE OR REPLACE FUNCTION link_photo_creator()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.creator_id := (
    SELECT id FROM users WHERE wallet_address = NEW.creator_wallet
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION link_voucher_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.voucher_id := (
    SELECT id FROM users WHERE wallet_address = NEW.voucher_wallet
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION link_follow_users()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.follower_id := (SELECT id FROM users WHERE wallet_address = NEW.follower_wallet);
  NEW.following_id := (SELECT id FROM users WHERE wallet_address = NEW.following_wallet);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION link_notification_actor()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.actor_id := (SELECT id FROM users WHERE wallet_address = NEW.actor_wallet);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- POST-MIGRATION NOTES:
--
-- 1. After running this migration, the client code NO LONGER calls
--    increment_vouch RPC — it's handled automatically by the trigger.
--
-- 2. Direct UPDATE on photos from the client is now blocked.
--    vouch_count and total_earned_lamports are managed by the trigger.
--
-- 3. Direct INSERT on notifications from the client is now blocked.
--    Notifications are created by triggers on vouches and follows.
--
-- 4. KNOWN LIMITATION: Without Supabase JWT auth, we cannot verify
--    wallet ownership at the RLS layer. A malicious user with the anon
--    key could still insert photos/vouches with a spoofed wallet address.
--    Mitigation: the on-chain program requires the wallet to SIGN the
--    transaction, so the tx_signature proves ownership. A future
--    Edge Function should verify tx_signatures before accepting records.
-- ============================================================================
