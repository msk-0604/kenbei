-- Recovery only if 20260923180000 must be undone BEFORE the app that calls consume is live.
-- If the new app is already deployed, roll back the app first, then run this.
-- Additive columns are unused by the previous app; dropping them is optional.
-- Do not run against Production unless explicitly requested.

-- DROP FUNCTION IF EXISTS public.consume_invite_signup_grant(text, text);
-- ALTER TABLE public.organization_invitations
--   DROP COLUMN IF EXISTS signup_grant_hash,
--   DROP COLUMN IF EXISTS signup_grant_expires_at,
--   DROP COLUMN IF EXISTS signup_grant_used_at;
