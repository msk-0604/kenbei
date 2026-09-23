-- Local-only invite join / preview checks. Does not target Production.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.set_jwt(p_user uuid, p_email text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.email', p_email, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'email', p_email)::text,
    true
  );
END;
$$;

DO $$
DECLARE
  v_owner uuid := '81111111-1111-4111-8111-111111111111';
  v_alias uuid := '82222222-2222-4222-8222-222222222222';
  v_other uuid := '83333333-3333-4333-8333-333333333333';
  v_second uuid := '84444444-4444-4444-8444-444444444444';
  v_role_worker uuid := '00000000-0000-4000-a000-000000000005';
  v_org uuid;
  v_org_b uuid;
  v_preview record;
  v_accepted uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated', 'join-owner@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_alias, 'authenticated', 'authenticated', 'yamamasaki0604+kenbei1@gmail.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_other, 'authenticated', 'authenticated', 'other-join@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_second, 'authenticated', 'authenticated', 'second-org@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '85555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'reuse@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.set_jwt(v_owner, 'join-owner@example.test');
  v_org := public.create_organization('招待検証会社A');

  PERFORM pg_temp.set_jwt(v_second, 'second-org@example.test');
  v_org_b := public.create_organization('招待検証会社B');

  PERFORM pg_temp.set_jwt(v_owner, 'join-owner@example.test');
  INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
  VALUES
    (v_org, 'yamamasaki0604+kenbei1@gmail.com', v_role_worker, 'join-alias-token-aaaaaaaaaaaaaaaaaa', v_owner, now() + interval '14 days'),
    (v_org, 'expired@example.test', v_role_worker, 'join-expired-token-aaaaaaaaaaaaaaaa', v_owner, now() - interval '1 day'),
    (v_org, 'reuse@example.test', v_role_worker, 'join-reuse-token-aaaaaaaaaaaaaaaaaa', v_owner, now() + interval '14 days');

  -- preview exposes invited_email, not org/role ids
  SELECT * INTO v_preview FROM public.preview_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
  IF v_preview.invite_state IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION 'preview ok expected, got %', v_preview.invite_state;
  END IF;
  IF v_preview.invited_email IS DISTINCT FROM 'yamamasaki0604+kenbei1@gmail.com' THEN
    RAISE EXCEPTION 'invited_email mismatch: %', v_preview.invited_email;
  END IF;
  IF v_preview.company_name IS DISTINCT FROM '招待検証会社A' THEN
    RAISE EXCEPTION 'company_name mismatch: %', v_preview.company_name;
  END IF;
  IF to_jsonb(v_preview) ? 'organization_id' OR to_jsonb(v_preview) ? 'role_id' THEN
    RAISE EXCEPTION 'preview leaked ids';
  END IF;

  SELECT * INTO v_preview FROM public.preview_organization_invite('join-expired-token-aaaaaaaaaaaaaaaa');
  IF v_preview.invite_state IS DISTINCT FROM 'expired' THEN
    RAISE EXCEPTION 'expired preview expected, got %', v_preview.invite_state;
  END IF;

  -- +alias matches only the exact invited address
  PERFORM pg_temp.set_jwt(v_other, 'yamamasaki0604@gmail.com');
  BEGIN
    PERFORM public.accept_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'base gmail should not match +alias invite';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invite email mismatch%' THEN
        RAISE EXCEPTION 'base gmail: unexpected %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.set_jwt(v_other, 'other-join@example.test');
  BEGIN
    PERFORM public.accept_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'other email should mismatch';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invite email mismatch%' THEN
        RAISE EXCEPTION 'other email: unexpected %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.set_jwt(v_second, 'second-org@example.test');
  BEGIN
    PERFORM public.accept_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'other org member should be blocked';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_ALREADY_IN_ORG%' AND SQLERRM NOT LIKE '%invite email mismatch%' THEN
        RAISE EXCEPTION 'other org: unexpected %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.set_jwt(v_alias, 'yamamasaki0604+kenbei1@gmail.com');
  v_accepted := public.accept_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
  IF v_accepted IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'alias accept failed';
  END IF;

  -- double accept
  BEGIN
    PERFORM public.accept_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'double accept should fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invite not found or expired%' THEN
        RAISE EXCEPTION 'double accept: unexpected %', SQLERRM;
      END IF;
  END;

  SELECT * INTO v_preview FROM public.preview_organization_invite('join-alias-token-aaaaaaaaaaaaaaaaaa');
  IF v_preview.invite_state IS DISTINCT FROM 'used' THEN
    RAISE EXCEPTION 'used preview expected, got %', v_preview.invite_state;
  END IF;

  -- expired accept
  PERFORM pg_temp.set_jwt(v_other, 'expired@example.test');
  BEGIN
    PERFORM public.accept_organization_invite('join-expired-token-aaaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'expired accept should fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invite not found or expired%' THEN
        RAISE EXCEPTION 'expired accept: unexpected %', SQLERRM;
      END IF;
  END;

  -- recovery: account exists, pending invite still open, accept works
  PERFORM pg_temp.set_jwt('85555555-5555-4555-8555-555555555555', 'reuse@example.test');
  v_accepted := public.accept_organization_invite('join-reuse-token-aaaaaaaaaaaaaaaaaa');
  IF v_accepted IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'recovery accept failed';
  END IF;
END $$;

ROLLBACK;
