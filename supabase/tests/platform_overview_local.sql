-- Executable checks for 20261017120000_platform_org_overview.sql (local DB only).
-- Rolls back at the end. Does not target Production.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect(p_ok boolean, p_label text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN
    RAISE EXCEPTION 'FAILED: %', p_label;
  END IF;
  RAISE NOTICE 'ok: %', p_label;
END;
$$;

INSERT INTO auth.users (id, email, raw_user_meta_data, last_sign_in_at) VALUES
  ('c1111111-1111-4111-8111-111111111111', 'overview-owner@example.test', '{"display_name":"運営テスト"}', now());

DO $$
DECLARE
  v_owner uuid := 'c1111111-1111-4111-8111-111111111111';
  v_org uuid;
  v_project uuid;
  v_row record;
  v_denied boolean := false;
BEGIN
  PERFORM pg_temp.as_user(v_owner);
  v_org := public.create_organization('運営ダッシュボード検証');
  INSERT INTO public.projects (organization_id, name, status) VALUES (v_org, '検証現場', 'active') RETURNING id INTO v_project;
  INSERT INTO public.workers (organization_id, name) VALUES (v_org, '田中');
  INSERT INTO public.schedules (organization_id, project_id, schedule_date) VALUES (v_org, v_project, current_date);

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM * FROM public.platform_org_overview();
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_denied, 'signed-in users cannot read every company');

  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT * INTO v_row FROM public.platform_org_overview() o WHERE o.organization_id = v_org;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_row.owner_email = 'overview-owner@example.test', 'owner email is listed');
  PERFORM pg_temp.expect(v_row.member_count = 1, 'members are counted');
  PERFORM pg_temp.expect(v_row.worker_count = 1 AND v_row.site_count = 1, 'workers and sites are counted');
  PERFORM pg_temp.expect(v_row.schedules_7d = 1 AND v_row.schedules_30d = 1, 'recent schedules are counted');
  PERFORM pg_temp.expect(v_row.last_activity_at IS NOT NULL AND v_row.last_sign_in_at IS NOT NULL, 'last activity is known');
  PERFORM pg_temp.expect(v_row.billing_status IS NOT NULL, 'billing row is joined');
END $$;

ROLLBACK;
