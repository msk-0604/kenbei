-- Executable checks for 20261021100000_platform_usage_analytics.sql (local DB only).
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

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c2222222-2222-4222-8222-222222222222', 'analytics-owner@example.test', '{"display_name":"分析テスト"}'),
  ('c3333333-3333-4333-8333-333333333333', 'analytics-empty@example.test', '{"display_name":"未使用テスト"}');

DO $$
DECLARE
  v_owner uuid := 'c2222222-2222-4222-8222-222222222222';
  v_empty_owner uuid := 'c3333333-3333-4333-8333-333333333333';
  v_org uuid;
  v_empty uuid;
  v_project uuid;
  v_sample uuid;
  v_row record;
  v_count int;
  v_denied boolean := false;
BEGIN
  PERFORM pg_temp.as_user(v_owner);
  v_org := public.create_organization('分析の検証');
  INSERT INTO public.projects (organization_id, name, status) VALUES (v_org, '検証現場', 'active') RETURNING id INTO v_project;
  INSERT INTO public.schedules (organization_id, project_id, schedule_date, actual_start_time)
    VALUES (v_org, v_project, current_date, now());
  INSERT INTO public.daily_reports (organization_id, project_id, work_on, body, status)
    VALUES (v_org, v_project, current_date, '検証', 'confirmed');

  PERFORM pg_temp.as_user(v_empty_owner);
  v_empty := public.create_organization('見本だけの会社');
  -- 見本の現場の予定は、使い始めたことに数えない
  INSERT INTO public.projects (organization_id, name, status, source) VALUES (v_empty, '【見本】現場', 'active', 'sample')
    RETURNING id INTO v_sample;
  INSERT INTO public.schedules (organization_id, project_id, schedule_date, actual_start_time)
    VALUES (v_empty, v_sample, current_date, now());

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM * FROM public.platform_org_activation();
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_denied, 'signed-in users cannot read every company''s activation');

  v_denied := false;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM * FROM public.platform_activity_daily(now() - interval '7 days');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_denied, 'signed-in users cannot read daily activity');

  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT * INTO v_row FROM public.platform_org_activation() a WHERE a.organization_id = v_org;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_row.has_schedule AND v_row.has_work_start AND v_row.has_confirmed_report, 'activation steps are found');
  PERFORM pg_temp.expect(NOT v_row.ever_paid, 'not paid yet');
  PERFORM pg_temp.expect(v_row.first_schedule_at IS NOT NULL AND v_row.first_report_at IS NOT NULL, 'first dates are known');

  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT * INTO v_row FROM public.platform_org_activation() a WHERE a.organization_id = v_empty;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(NOT v_row.has_schedule AND NOT v_row.has_work_start, 'sample schedules are not counted');

  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT coalesce(sum(d.n), 0) INTO v_count FROM public.platform_activity_daily(now() - interval '7 days') d
    WHERE d.organization_id = v_org AND d.kind IN ('schedule', 'work_start', 'report');
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_count = 3, 'daily activity counts schedule, work start and report');

  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT coalesce(sum(d.n), 0) INTO v_count FROM public.platform_activity_daily(now() - interval '7 days') d
    WHERE d.organization_id = v_empty;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_count = 0, 'sample activity is not counted');
END $$;

ROLLBACK;
