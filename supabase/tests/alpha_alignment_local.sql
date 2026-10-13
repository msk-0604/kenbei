-- Executable checks for 20261013100000_alpha_alignment.sql (local DB only).
-- Schedules / workers / progress checklist / notices / completed_at / crew login.
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
  ('a1111111-1111-4111-8111-111111111111', 'alpha-owner@example.test', '{"display_name":"管理者A"}'),
  ('a2222222-2222-4222-8222-222222222222', 'alpha-worker@example.test', '{"display_name":"個人の作業員"}'),
  ('a3333333-3333-4333-8333-333333333333', 'crew@example.test', '{"display_name":"作業員（共通ログイン）"}'),
  ('b1111111-1111-4111-8111-111111111111', 'other-owner@example.test', '{"display_name":"他社"}');

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value uuid);
GRANT ALL ON ctx TO authenticated;

DO $$
DECLARE
  v_owner uuid := 'a1111111-1111-4111-8111-111111111111';
  v_other uuid := 'b1111111-1111-4111-8111-111111111111';
  v_org uuid;
  v_org_b uuid;
BEGIN
  PERFORM pg_temp.as_user(v_owner);
  v_org := public.create_organization('アルファ検証');
  PERFORM pg_temp.as_user(v_other);
  v_org_b := public.create_organization('他社検証');
  INSERT INTO ctx VALUES ('org', v_org), ('org_b', v_org_b);
END $$;

-- Individual worker (not assigned to the project) and the crew login, created by the server.
DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_crew uuid := 'a3333333-3333-4333-8333-333333333333';
  v_failed boolean := false;
BEGIN
  INSERT INTO public.memberships (organization_id, profile_id, role_id, status)
  VALUES (v_org, 'a2222222-2222-4222-8222-222222222222', '00000000-0000-4000-a000-000000000005', 'active');

  BEGIN
    INSERT INTO public.memberships (organization_id, profile_id, role_id, status)
    VALUES (v_org, v_crew, '00000000-0000-4000-a000-000000000009', 'active');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'crew role needs the org worker passcode row');

  INSERT INTO public.organization_passcodes (organization_id, kind, profile_id, passcode_hash)
  VALUES (v_org, 'worker', v_crew, 'scrypt$test');
  INSERT INTO public.memberships (organization_id, profile_id, role_id, status)
  VALUES (v_org, v_crew, '00000000-0000-4000-a000-000000000009', 'active');
  PERFORM pg_temp.expect(public.organization_crew_profile_id(v_org) = v_crew, 'crew profile resolves');
END $$;

SET LOCAL ROLE authenticated;

-- Owner registers a site, a worker and a schedule.
DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_project uuid;
  v_worker uuid;
  v_schedule uuid;
  v_completed timestamptz;
BEGIN
  PERFORM pg_temp.as_user('a1111111-1111-4111-8111-111111111111');
  INSERT INTO public.projects (organization_id, name, status, work_duration)
  VALUES (v_org, '蹴上 空き家', 'active', 'one_off')
  RETURNING id INTO v_project;

  INSERT INTO public.workers (organization_id, name) VALUES (v_org, '山田') RETURNING id INTO v_worker;
  INSERT INTO public.schedules (organization_id, project_id, worker_id, schedule_date, work_content)
  VALUES (v_org, v_project, v_worker, current_date, '1階キッチンの給水')
  RETURNING id INTO v_schedule;

  INSERT INTO ctx VALUES ('project', v_project), ('worker', v_worker), ('schedule', v_schedule);

  UPDATE public.projects SET status = 'completed' WHERE id = v_project;
  SELECT completed_at INTO v_completed FROM public.projects WHERE id = v_project;
  PERFORM pg_temp.expect(v_completed IS NOT NULL, 'completed_at is set when a site becomes completed');
  UPDATE public.projects SET name = '蹴上 空き家（改）' WHERE id = v_project;
  PERFORM pg_temp.expect(
    (SELECT completed_at FROM public.projects WHERE id = v_project) = v_completed,
    'completed_at is kept on other updates'
  );
  UPDATE public.projects SET status = 'active' WHERE id = v_project;
  PERFORM pg_temp.expect(
    (SELECT completed_at FROM public.projects WHERE id = v_project) IS NULL,
    'completed_at is cleared when reopened'
  );
END $$;

-- Crew login sees every site, records work start/end, but cannot edit schedules.
DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_schedule uuid := (SELECT value FROM ctx WHERE key = 'schedule');
  v_row public.schedules;
  v_count int;
  v_failed boolean := false;
BEGIN
  PERFORM pg_temp.as_user('a3333333-3333-4333-8333-333333333333');
  SELECT count(*) INTO v_count FROM public.schedules WHERE organization_id = v_org;
  PERFORM pg_temp.expect(v_count = 1, 'crew can read schedules');

  UPDATE public.schedules SET memo = 'x' WHERE id = v_schedule;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM pg_temp.expect(v_count = 0, 'crew cannot edit schedules directly');

  BEGIN
    PERFORM public.record_schedule_work(v_schedule, 'end');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'work cannot end before it starts');

  v_row := public.record_schedule_work(v_schedule, 'start');
  PERFORM pg_temp.expect(v_row.status = 'in_progress' AND v_row.actual_start_time IS NOT NULL, 'crew starts work');
  v_row := public.record_schedule_work(v_schedule, 'end');
  PERFORM pg_temp.expect(v_row.status = 'completed' AND v_row.actual_end_time IS NOT NULL, 'crew ends work');
END $$;

-- An individual worker who is not on the project sees nothing of it.
DO $$
DECLARE
  v_count int;
BEGIN
  PERFORM pg_temp.as_user('a2222222-2222-4222-8222-222222222222');
  SELECT count(*) INTO v_count FROM public.schedules;
  PERFORM pg_temp.expect(v_count = 0, 'unassigned individual worker does not see the site schedules');
  SELECT count(*) INTO v_count FROM public.workers;
  PERFORM pg_temp.expect(v_count = 1, 'members can read the worker roster');
  INSERT INTO public.workers (organization_id, name)
  SELECT value, '勝手に追加' FROM ctx WHERE key = 'org'
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: non-admin cannot add workers';
END $$;

-- Other company sees nothing.
DO $$
DECLARE
  v_count int;
  v_failed boolean := false;
BEGIN
  PERFORM pg_temp.as_user('b1111111-1111-4111-8111-111111111111');
  SELECT count(*) INTO v_count FROM public.schedules;
  PERFORM pg_temp.expect(v_count = 0, 'other company cannot read schedules');
  SELECT count(*) INTO v_count FROM public.workers;
  PERFORM pg_temp.expect(v_count = 0, 'other company cannot read workers');
  BEGIN
    INSERT INTO public.schedules (organization_id, project_id, schedule_date)
    SELECT (SELECT value FROM ctx WHERE key = 'org_b'), (SELECT value FROM ctx WHERE key = 'project'), current_date;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'cannot attach a schedule to another company site');
END $$;

-- Progress checklist: crew adds items and marks them; definitions and marks are guarded.
DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_project uuid := (SELECT value FROM ctx WHERE key = 'project');
  v_item public.project_progress_items;
  v_failed boolean;
BEGIN
  PERFORM pg_temp.as_user('a3333333-3333-4333-8333-333333333333');
  INSERT INTO public.project_progress_items (organization_id, project_id, category, section, item_name, mark)
  VALUES (v_org, v_project, '屋内', '1階', 'キッチン・給水', 'ok')
  RETURNING * INTO v_item;
  PERFORM pg_temp.expect(v_item.mark = 'none' AND v_item.checked = false, 'new items always start unmarked');

  v_failed := false;
  BEGIN
    UPDATE public.project_progress_items SET mark = 'ok' WHERE id = v_item.id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'marks change only through set_progress_mark');

  v_failed := false;
  BEGIN
    UPDATE public.project_progress_items SET item_name = '別の名前' WHERE id = v_item.id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'workers cannot rename items');

  UPDATE public.project_progress_items SET sort_order = -5 WHERE id = v_item.id;

  v_item := public.set_progress_mark(v_item.id, 'ok', 1, '山田');
  PERFORM pg_temp.expect(v_item.version = 2 AND v_item.checked AND v_item.status = 'completed', 'set_progress_mark updates mark and version');

  v_failed := false;
  BEGIN
    PERFORM public.set_progress_mark(v_item.id, 'attention', 1, '山田');
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM = 'conflict';
  END;
  PERFORM pg_temp.expect(v_failed, 'stale version is rejected as a conflict');

  PERFORM pg_temp.expect(
    (SELECT count(*) FROM public.progress_item_history WHERE item_id = v_item.id AND actor_name = '山田') = 1,
    'mark changes are written to history with the person name'
  );

  PERFORM pg_temp.as_user('a1111111-1111-4111-8111-111111111111');
  UPDATE public.project_progress_items SET item_name = 'キッチン・給湯' WHERE id = v_item.id;
  PERFORM pg_temp.expect(
    (SELECT item_name FROM public.project_progress_items WHERE id = v_item.id) = 'キッチン・給湯',
    'admins can rename items'
  );
END $$;

-- Notices: actor excluded; completion can include the actor; project access respected; dedupe works.
DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_project uuid := (SELECT value FROM ctx WHERE key = 'project');
  v_ids uuid[];
  v_failed boolean := false;
BEGIN
  PERFORM pg_temp.as_user('a1111111-1111-4111-8111-111111111111');
  SELECT array_agg(id) INTO v_ids
  FROM public.post_org_notice(v_org, v_project, 'site_created', '新しい現場が追加されました', '蹴上', '/sites/x', 'site-published:test', false) AS id;
  PERFORM pg_temp.expect(
    v_ids = ARRAY['a3333333-3333-4333-8333-333333333333'::uuid],
    'site notice goes to crew only (actor and unassigned worker excluded)'
  );

  SELECT array_agg(id) INTO v_ids
  FROM public.post_org_notice(v_org, v_project, 'site_created', '新しい現場が追加されました', '蹴上', '/sites/x', 'site-published:test', false) AS id;
  PERFORM pg_temp.expect(v_ids IS NULL, 'same dedupe key is not delivered twice');

  SELECT array_agg(id ORDER BY id) INTO v_ids
  FROM public.post_org_notice(v_org, v_project, 'site_completed', '現場が完了しました', '蹴上', '/sites/x', 'site-completed:test', true) AS id;
  PERFORM pg_temp.expect(
    v_ids = ARRAY['a1111111-1111-4111-8111-111111111111'::uuid, 'a3333333-3333-4333-8333-333333333333'::uuid],
    'completion notice also reaches the admin who completed it'
  );

  SELECT array_agg(id ORDER BY id) INTO v_ids
  FROM public.post_org_notice(v_org, NULL, 'worker_created', '作業員が登録されました', NULL, '//evil.example', NULL, false) AS id;
  PERFORM pg_temp.expect(array_length(v_ids, 1) = 2, 'company-wide notice reaches every other member');
  PERFORM pg_temp.expect(
    NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'worker_created' AND href IS NOT NULL),
    'off-site links are dropped'
  );

  PERFORM pg_temp.as_user('a3333333-3333-4333-8333-333333333333');
  BEGIN
    PERFORM public.post_org_notice(v_org, v_project, 'site_completed', 'x', NULL, NULL, NULL, true);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'only admins can send notices that include themselves');

  UPDATE public.notifications SET read_at = now() WHERE profile_id = auth.uid();
  v_failed := false;
  BEGIN
    UPDATE public.notifications SET title = '書き換え' WHERE profile_id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'notice text is immutable');
END $$;

-- Passcode hashes are never readable by app users.
DO $$
DECLARE
  v_failed boolean := false;
BEGIN
  PERFORM pg_temp.as_user('a1111111-1111-4111-8111-111111111111');
  BEGIN
    PERFORM 1 FROM public.organization_passcodes;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'organization_passcodes is server-only');
END $$;

-- Revoking crew sessions: server only, removes the crew login's sessions and refresh tokens.
RESET ROLE;
DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_crew uuid := 'a3333333-3333-4333-8333-333333333333';
  v_owner uuid := 'a1111111-1111-4111-8111-111111111111';
  v_session uuid := gen_random_uuid();
  v_failed boolean := false;
BEGIN
  IF to_regclass('auth.sessions') IS NULL THEN
    RAISE NOTICE 'ok: (skipped session revocation: no auth.sessions in this database)';
    RETURN;
  END IF;
  INSERT INTO auth.sessions (id, user_id) VALUES (v_session, v_crew), (gen_random_uuid(), v_owner);
  INSERT INTO auth.refresh_tokens (token, user_id, session_id) VALUES ('crew-token', v_crew::text, v_session);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.as_user(v_owner);
  BEGIN
    PERFORM public.revoke_crew_sessions(v_org);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(v_failed, 'app users cannot call revoke_crew_sessions directly');

  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM pg_temp.expect(public.revoke_crew_sessions(v_org) = 1, 'server revokes the crew session');
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.expect(
    NOT EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = v_crew)
      AND NOT EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE user_id = v_crew::text),
    'crew sessions and refresh tokens are gone'
  );
  PERFORM pg_temp.expect(
    EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = v_owner),
    'other members stay signed in'
  );
END $$;

ROLLBACK;
