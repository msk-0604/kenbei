-- Executable tenant isolation test for CI (local Supabase only).
-- Company A must not read or write Company B data.
-- Run via: node scripts/run-rls-isolation.mjs
-- Does not target Production.

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
  v_user_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_user_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_a,
      'authenticated',
      'authenticated',
      'rls-a@example.test',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_b,
      'authenticated',
      'authenticated',
      'rls-b@example.test',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  ON CONFLICT (id) DO NOTHING;
END $$;

DO $$
DECLARE
  v_user_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_user_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_org_a uuid;
  v_org_b uuid;
  v_seen int;
  v_insert_ok boolean := false;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';

  PERFORM pg_temp.set_jwt(v_user_a, 'rls-a@example.test');
  v_org_a := public.create_organization('RLS会社A');

  PERFORM pg_temp.set_jwt(v_user_b, 'rls-b@example.test');
  v_org_b := public.create_organization('RLS会社B');

  INSERT INTO public.projects (organization_id, name, created_by, updated_by)
  VALUES (v_org_b, '会社Bの現場', v_user_b, v_user_b);

  INSERT INTO public.export_jobs (organization_id, requested_by, status, format)
  VALUES (v_org_b, v_user_b, 'queued', 'zip');

  PERFORM pg_temp.set_jwt(v_user_a, 'rls-a@example.test');

  SELECT count(*) INTO v_seen FROM public.organizations;
  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'RLS fail: user A saw % organizations, expected 1', v_seen;
  END IF;

  SELECT count(*) INTO v_seen FROM public.projects WHERE organization_id = v_org_b;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'RLS fail: user A read Company B projects';
  END IF;

  SELECT count(*) INTO v_seen FROM public.export_jobs WHERE organization_id = v_org_b;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'RLS fail: user A read Company B export_jobs';
  END IF;

  SELECT count(*) INTO v_seen FROM public.organization_billing WHERE organization_id = v_org_b;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'RLS fail: user A read Company B billing';
  END IF;

  SELECT count(*) INTO v_seen FROM public.memberships WHERE organization_id = v_org_b;
  IF v_seen <> 0 THEN
    RAISE EXCEPTION 'RLS fail: user A read Company B memberships';
  END IF;

  BEGIN
    INSERT INTO public.projects (organization_id, name, created_by, updated_by)
    VALUES (v_org_b, '侵入', v_user_a, v_user_a);
    v_insert_ok := true;
  EXCEPTION
    WHEN OTHERS THEN
      v_insert_ok := false;
  END;
  IF v_insert_ok THEN
    RAISE EXCEPTION 'RLS fail: user A inserted a project into Company B';
  END IF;
END $$;

ROLLBACK;
