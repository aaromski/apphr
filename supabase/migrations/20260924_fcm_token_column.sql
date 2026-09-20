-- ============================================================
-- AppHR - Add FCM Token column to profiles table
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Index for faster lookups (optional, but useful for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON public.profiles (fcm_token) WHERE fcm_token IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.profiles.fcm_token IS 'Firebase Cloud Messaging token for push notifications';