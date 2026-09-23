-- READ-ONLY Production preflight for 20260923180000. Do not apply the migration from this file.
-- Do not print tokens, hashes, or emails.

SELECT
  (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_invitations'
      AND column_name IN ('signup_grant_hash', 'signup_grant_expires_at', 'signup_grant_used_at')
  ) AS grant_columns_present,
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'consume_invite_signup_grant'
  ) AS consume_function_present,
  (
    SELECT count(*)
    FROM public.organization_invitations
    WHERE deleted_at IS NULL
      AND accepted_at IS NULL
      AND expires_at > now()
  ) AS pending_invites_open,
  (
    SELECT count(*)
    FROM public.billing_plans
  ) AS billing_plan_rows,
  (
    SELECT count(*)
    FROM public.organization_billing
  ) AS billing_rows;
