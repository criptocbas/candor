-- Engagement Features Migration
-- Adds: verification streaks, realtime notifications support

-- ============================================================
-- 1. VERIFICATION STREAKS
-- ============================================================

-- Add streak columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_verified_date date;

-- Trigger: update streak when a photo is verified
CREATE OR REPLACE FUNCTION update_verification_streak()
RETURNS trigger AS $$
DECLARE
  user_streak integer;
  user_longest integer;
  user_last_date date;
  today_date date := CURRENT_DATE;
BEGIN
  SELECT current_streak, longest_streak, last_verified_date
  INTO user_streak, user_longest, user_last_date
  FROM users WHERE wallet_address = NEW.creator_wallet;

  -- If no user found, nothing to do
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF user_last_date = today_date THEN
    -- Already verified today, no streak change
    RETURN NEW;
  ELSIF user_last_date = today_date - 1 THEN
    -- Consecutive day, increment
    user_streak := user_streak + 1;
  ELSE
    -- Streak broken or first time
    user_streak := 1;
  END IF;

  IF user_streak > COALESCE(user_longest, 0) THEN
    user_longest := user_streak;
  END IF;

  UPDATE users SET
    current_streak = user_streak,
    longest_streak = user_longest,
    last_verified_date = today_date
  WHERE wallet_address = NEW.creator_wallet;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to allow re-running
DROP TRIGGER IF EXISTS update_streak_on_photo ON photos;
CREATE TRIGGER update_streak_on_photo
  AFTER INSERT ON photos
  FOR EACH ROW EXECUTE FUNCTION update_verification_streak();

-- ============================================================
-- 2. REALTIME NOTIFICATIONS
-- ============================================================

-- Enable realtime on notifications table so clients can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
