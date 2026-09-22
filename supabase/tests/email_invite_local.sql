-- Local-only email invite checks. Does not target Production.
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
  v_owner uuid := '71111111-1111-4111-8111-111111111111';
  v_member uuid := '72222222-2222-4222-8222-222222222222';
  v_other uuid := '73333333-3333-4333-8333-333333333333';
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated', 'mail-owner@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_member, 'authenticated', 'authenticated', 'invitee@company.jp', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_other, 'authenticated', 'authenticated', 'other@company.jp', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;
END $$;

DO $$
DECLARE
  v_owner uuid := '71111111-1111-4111-8111-111111111111';
  v_member uuid := '72222222-2222-4222-8222-222222222222';
  v_other uuid := '73333333-3333-4333-8333-333333333333';
  v_role_worker uuid := '00000000-0000-4000-a000-000000000005';
  v_role_owner uuid := '00000000-0000-4000-a000-000000000001';
  v_org uuid;
  v_accepted uuid;
  v_count int;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.set_jwt(v_owner, 'mail-owner@example.test');
  v_org := public.create_organization('メール招待会社');

  BEGIN
    INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
    VALUES (v_org, 'invitee@company.jp', v_role_owner, 'email-owner-token-aaaaaaaaaaaaaaaa', v_owner, now() + interval '14 days');
    RAISE EXCEPTION 'owner email invite should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_INVITE_ROLE%' THEN
        RAISE EXCEPTION 'owner email invite: expected KENBEI_INVITE_ROLE got %', SQLERRM;
      END IF;
  END;

  INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
  VALUES (v_org, 'invitee@company.jp', v_role_worker, 'email-worker-token-aaaaaaaaaaaaaaa', v_owner, now() + interval '14 days');

  PERFORM pg_temp.set_jwt(v_other, 'other@company.jp');
  BEGIN
    PERFORM public.accept_organization_invite('email-worker-token-aaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'other email accept should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invite email mismatch%' THEN
        RAISE EXCEPTION 'email mismatch: unexpected %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.set_jwt(v_member, 'invitee@company.jp');
  v_accepted := public.accept_organization_invite('email-worker-token-aaaaaaaaaaaaaaa');
  IF v_accepted IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'matching email accept failed';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.memberships
  WHERE organization_id = v_org AND status = 'active' AND deleted_at IS NULL;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'expected 2 active members, got %', v_count;
  END IF;

  BEGIN
    PERFORM public.accept_organization_invite('email-worker-token-aaaaaaaaaaaaaaa');
    RAISE EXCEPTION 'used invite reuse should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invite not found or expired%' THEN
        RAISE EXCEPTION 'reuse: unexpected %', SQLERRM;
      END IF;
  END;
END $$;

ROLLBACK;
