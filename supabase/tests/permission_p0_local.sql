-- Local-only P0 permission verification. Does not target Production.
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

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_needle text)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_ok boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
    v_ok := true;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%' || p_needle || '%' THEN
        RAISE EXCEPTION 'expected % but got %', p_needle, SQLERRM;
      END IF;
      RETURN;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'expected error % but statement succeeded: %', p_needle, p_sql;
  END IF;
END;
$$;

DO $$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_worker uuid := '22222222-2222-4222-8222-222222222222';
  v_supervisor uuid := '33333333-3333-4333-8333-333333333333';
  v_manager uuid := '44444444-4444-4444-8444-444444444444';
  v_other uuid := '55555555-5555-4555-8555-555555555555';
  v_invitee uuid := '66666666-6666-4666-8666-666666666666';
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated', 'p0-owner@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_worker, 'authenticated', 'authenticated', 'p0-worker@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_supervisor, 'authenticated', 'authenticated', 'p0-supervisor@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_manager, 'authenticated', 'authenticated', 'p0-manager@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_other, 'authenticated', 'authenticated', 'p0-other@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_invitee, 'authenticated', 'authenticated', 'p0-invitee@example.test', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;
END $$;

DO $$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_worker uuid := '22222222-2222-4222-8222-222222222222';
  v_supervisor uuid := '33333333-3333-4333-8333-333333333333';
  v_manager uuid := '44444444-4444-4444-8444-444444444444';
  v_other uuid := '55555555-5555-4555-8555-555555555555';
  v_invitee uuid := '66666666-6666-4666-8666-666666666666';
  v_role_owner uuid := '00000000-0000-4000-a000-000000000001';
  v_role_manager uuid := '00000000-0000-4000-a000-000000000003';
  v_role_supervisor uuid := '00000000-0000-4000-a000-000000000004';
  v_role_worker uuid := '00000000-0000-4000-a000-000000000005';
  v_org_a uuid;
  v_org_b uuid;
  v_owner_m uuid;
  v_worker_m uuid;
  v_supervisor_m uuid;
  v_manager_m uuid;
  v_other_m uuid;
  v_rows int;
  v_invite_id uuid;
  v_accepted uuid;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';

  PERFORM pg_temp.set_jwt(v_owner, 'p0-owner@example.test');
  v_org_a := public.create_organization('P0会社A');
  PERFORM pg_temp.set_jwt(v_other, 'p0-other@example.test');
  v_org_b := public.create_organization('P0会社B');
  SELECT id INTO v_other_m FROM public.memberships WHERE organization_id = v_org_b AND profile_id = v_other;

  PERFORM pg_temp.set_jwt(v_owner, 'p0-owner@example.test');
  SELECT id INTO v_owner_m FROM public.memberships WHERE organization_id = v_org_a AND profile_id = v_owner;

  BEGIN
    INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
    VALUES (v_org_a, NULL, v_role_owner, 'p0-owner-invite-token', v_owner, now() + interval '14 days');
    RAISE EXCEPTION 'owner invite should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_INVITE_ROLE%' THEN
        RAISE EXCEPTION 'owner invite: expected KENBEI_INVITE_ROLE got %', SQLERRM;
      END IF;
  END;

  INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
  VALUES (v_org_a, NULL, v_role_worker, 'p0-worker-invite-token', v_owner, now() + interval '14 days');
  INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
  VALUES (v_org_a, NULL, v_role_supervisor, 'p0-supervisor-invite-token', v_owner, now() + interval '14 days');
  INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
  VALUES (v_org_a, NULL, v_role_manager, 'p0-manager-invite-token', v_owner, now() + interval '14 days');
  INSERT INTO public.organization_invitations (organization_id, email, role_id, token, invited_by, expires_at)
  VALUES (v_org_a, NULL, v_role_worker, 'p0-invitee-accept-token', v_owner, now() + interval '14 days')
  RETURNING id INTO v_invite_id;

  PERFORM pg_temp.set_jwt(v_worker, 'p0-worker@example.test');
  PERFORM public.accept_organization_invite('p0-worker-invite-token');
  SELECT id INTO v_worker_m FROM public.memberships WHERE organization_id = v_org_a AND profile_id = v_worker AND deleted_at IS NULL;

  PERFORM pg_temp.set_jwt(v_supervisor, 'p0-supervisor@example.test');
  PERFORM public.accept_organization_invite('p0-supervisor-invite-token');
  SELECT id INTO v_supervisor_m FROM public.memberships WHERE organization_id = v_org_a AND profile_id = v_supervisor AND deleted_at IS NULL;

  PERFORM pg_temp.set_jwt(v_manager, 'p0-manager@example.test');
  PERFORM public.accept_organization_invite('p0-manager-invite-token');
  SELECT id INTO v_manager_m FROM public.memberships WHERE organization_id = v_org_a AND profile_id = v_manager AND deleted_at IS NULL;

  PERFORM pg_temp.set_jwt(v_invitee, 'p0-invitee@example.test');
  v_accepted := public.accept_organization_invite('p0-invitee-accept-token');
  IF v_accepted IS DISTINCT FROM v_org_a THEN
    RAISE EXCEPTION 'normal invite accept failed';
  END IF;

  PERFORM pg_temp.set_jwt(v_worker, 'p0-worker@example.test');
  UPDATE public.memberships SET role_id = v_role_owner WHERE id = v_worker_m;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'worker self-escalation to owner was not rejected';
  END IF;

  PERFORM pg_temp.set_jwt(v_supervisor, 'p0-supervisor@example.test');
  UPDATE public.memberships SET role_id = v_role_owner WHERE id = v_supervisor_m;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'supervisor self-escalation to owner was not rejected';
  END IF;

  PERFORM pg_temp.set_jwt(v_manager, 'p0-manager@example.test');
  BEGIN
    UPDATE public.memberships SET role_id = v_role_owner WHERE id = v_manager_m;
    RAISE EXCEPTION 'manager self-escalation should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_OWNER_GRANT%' THEN
        RAISE EXCEPTION 'manager self-escalation: expected KENBEI_OWNER_GRANT got %', SQLERRM;
      END IF;
  END;

  BEGIN
    UPDATE public.memberships SET role_id = v_role_owner WHERE id = v_worker_m;
    RAISE EXCEPTION 'manager promoting worker to owner should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_OWNER_GRANT%' THEN
        RAISE EXCEPTION 'manager owner-grant: expected KENBEI_OWNER_GRANT got %', SQLERRM;
      END IF;
  END;

  BEGIN
    UPDATE public.memberships SET role_id = v_role_supervisor WHERE id = v_worker_m;
    RAISE EXCEPTION 'role change should have been locked';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_ROLE_LOCKED%' THEN
        RAISE EXCEPTION 'role lock: expected KENBEI_ROLE_LOCKED got %', SQLERRM;
      END IF;
  END;

  BEGIN
    UPDATE public.memberships SET role_id = v_role_manager WHERE id = v_owner_m;
    RAISE EXCEPTION 'last owner demotion should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_LAST_OWNER%' THEN
        RAISE EXCEPTION 'last owner demotion: expected KENBEI_LAST_OWNER got %', SQLERRM;
      END IF;
  END;

  BEGIN
    PERFORM public.set_membership_status(v_owner_m, 'disabled');
    RAISE EXCEPTION 'last owner disable should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_LAST_OWNER%' AND SQLERRM NOT LIKE '%KENBEI_LAST_MANAGER%' THEN
        RAISE EXCEPTION 'last owner disable: expected KENBEI_LAST_OWNER got %', SQLERRM;
      END IF;
  END;

  BEGIN
    UPDATE public.memberships SET organization_id = v_org_b WHERE id = v_worker_m;
    RAISE EXCEPTION 'organization_id reassignment should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_ORG_MISMATCH%' THEN
        RAISE EXCEPTION 'org reassignment: expected KENBEI_ORG_MISMATCH got %', SQLERRM;
      END IF;
  END;

  BEGIN
    UPDATE public.memberships SET profile_id = v_other WHERE id = v_worker_m;
    RAISE EXCEPTION 'profile_id reassignment should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%KENBEI_ROLE_LOCKED%' THEN
        RAISE EXCEPTION 'profile reassignment: expected KENBEI_ROLE_LOCKED got %', SQLERRM;
      END IF;
  END;

  IF v_other_m IS NULL THEN
    RAISE EXCEPTION 'org B membership was not captured';
  END IF;
  UPDATE public.memberships SET status = 'disabled' WHERE id = v_other_m;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'cross-organization membership update was not rejected';
  END IF;

  BEGIN
    PERFORM public.set_membership_status(v_other_m, 'disabled');
    RAISE EXCEPTION 'cross-organization RPC should have been rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%permission denied%' AND SQLERRM NOT LIKE '%KENBEI_%' THEN
        RAISE EXCEPTION 'cross-org RPC: unexpected %', SQLERRM;
      END IF;
  END;
END $$;

ROLLBACK;
