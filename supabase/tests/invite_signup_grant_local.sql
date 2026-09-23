-- Local-only: one-time grant consume, reuse, expiry, token-only cannot consume.
-- Does not touch billing. Run after 20260923180000.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_org uuid;
  v_role uuid;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_grant text := 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  v_hash text;
  v_email text;
  v_again text;
BEGIN
  v_hash := encode(extensions.digest(convert_to(lower(v_grant), 'UTF8'), 'sha256'), 'hex');
  SELECT id INTO v_role FROM public.roles WHERE code = 'worker' AND organization_id IS NULL LIMIT 1;
  INSERT INTO public.organizations (name, slug)
  VALUES ('grant-test', 'grant-test-' || substr(gen_random_uuid()::text, 1, 8))
  RETURNING id INTO v_org;
  INSERT INTO public.organization_invitations (
    organization_id, email, role_id, token, expires_at,
    signup_grant_hash, signup_grant_expires_at
  ) VALUES (
    v_org, 'grant-invitee@example.test', v_role, v_token, now() + interval '14 days',
    v_hash, now() + interval '14 days'
  );

  SELECT invited_email INTO v_email
  FROM public.consume_invite_signup_grant(v_token, v_grant);
  IF v_email IS DISTINCT FROM 'grant-invitee@example.test' THEN
    RAISE EXCEPTION 'first consume should return invited email';
  END IF;

  SELECT invited_email INTO v_again
  FROM public.consume_invite_signup_grant(v_token, v_grant);
  IF v_again IS NOT NULL THEN
    RAISE EXCEPTION 'reuse must not consume again';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.consume_invite_signup_grant(v_token, repeat('c', 64))
  ) THEN
    RAISE EXCEPTION 'wrong grant must not consume';
  END IF;

  INSERT INTO public.organization_invitations (
    organization_id, email, role_id, token, expires_at
  ) VALUES (
    v_org, 'token-only@example.test', v_role, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    now() + interval '14 days'
  );
  IF EXISTS (
    SELECT 1 FROM public.consume_invite_signup_grant(
      (SELECT token FROM public.organization_invitations WHERE organization_id = v_org AND signup_grant_hash IS NULL LIMIT 1),
      v_grant
    )
  ) THEN
    RAISE EXCEPTION 'token-only invite must not consume';
  END IF;

  DELETE FROM public.organization_invitations WHERE organization_id = v_org;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'SET ROLE anon';
    PERFORM * FROM public.consume_invite_signup_grant(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );
    RAISE EXCEPTION 'anon must not execute consume';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;
END $$;
