-- One-time signup grant for invite emails only. Does not change RLS, accept, trial, or billing.
-- consume is callable by service_role only; knowing token without grant cannot confirm an email.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS signup_grant_hash text,
  ADD COLUMN IF NOT EXISTS signup_grant_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_grant_used_at timestamptz;

CREATE OR REPLACE FUNCTION public.consume_invite_signup_grant(p_token text, p_grant text)
RETURNS TABLE (invited_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{32,}$' THEN
    RETURN;
  END IF;
  IF p_grant IS NULL OR p_grant !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;
  v_hash := encode(extensions.digest(convert_to(lower(p_grant), 'UTF8'), 'sha256'), 'hex');

  RETURN QUERY
  UPDATE public.organization_invitations AS i
  SET signup_grant_used_at = now()
  WHERE i.token = p_token
    AND i.deleted_at IS NULL
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
    AND i.email IS NOT NULL
    AND i.signup_grant_hash = v_hash
    AND i.signup_grant_used_at IS NULL
    AND i.signup_grant_expires_at IS NOT NULL
    AND i.signup_grant_expires_at > now()
  RETURNING lower(i.email);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_invite_signup_grant(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_signup_grant(text, text) TO service_role;
