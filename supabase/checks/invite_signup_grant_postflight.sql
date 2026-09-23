-- READ-ONLY postflight after 20260923180000. Do not print tokens, hashes, or emails.

SELECT
  (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_invitations'
      AND column_name IN ('signup_grant_hash', 'signup_grant_expires_at', 'signup_grant_used_at')
  ) AS grant_columns_present,
  (
    SELECT prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'consume_invite_signup_grant'
  ) AS consume_security_definer,
  (
    SELECT has_function_privilege('anon', 'public.consume_invite_signup_grant(text, text)', 'EXECUTE')
  ) AS anon_can_execute,
  (
    SELECT has_function_privilege('authenticated', 'public.consume_invite_signup_grant(text, text)', 'EXECUTE')
  ) AS authenticated_can_execute,
  (
    SELECT has_function_privilege('service_role', 'public.consume_invite_signup_grant(text, text)', 'EXECUTE')
  ) AS service_role_can_execute,
  (
    SELECT count(*)
    FROM public.organization_invitations
    WHERE deleted_at IS NULL
      AND accepted_at IS NULL
      AND signup_grant_hash IS NOT NULL
  ) AS pending_with_grant,
  (
    SELECT count(*)
    FROM pg_policies
    WHERE tablename IN ('organization_invitations', 'organization_billing', 'billing_plans')
  ) AS related_policy_count;
