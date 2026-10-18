-- Executable checks for 20261017130000_soft_delete_sites.sql (local DB only).
-- Rolls back at the end. Does not target Production.

BEGIN;

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
  ('e1111111-1111-4111-8111-111111111111', 'delete-owner@example.test', '{"display_name":"削除テスト"}'),
  ('e2222222-2222-4222-8222-222222222222', 'delete-worker@example.test', '{"display_name":"作業員"}'),
  ('e3333333-3333-4333-8333-333333333333', 'delete-other@example.test', '{"display_name":"他社"}');

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value uuid);
GRANT ALL ON ctx TO authenticated;

SELECT
  set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true),
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
INSERT INTO ctx SELECT 'org', public.create_organization('削除検証');
INSERT INTO public.memberships (organization_id, profile_id, role_id, status)
SELECT value, 'e2222222-2222-4222-8222-222222222222', '00000000-0000-4000-a000-000000000005', 'active' FROM ctx WHERE key = 'org';

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_site uuid;
  v_failed boolean := false;
BEGIN
  INSERT INTO public.projects (organization_id, name, status) VALUES (v_org, '削除する現場', 'active') RETURNING id INTO v_site;
  INSERT INTO public.schedules (organization_id, project_id, schedule_date) VALUES (v_org, v_site, current_date);
  INSERT INTO public.project_progress_items (organization_id, project_id, item_name) VALUES (v_org, v_site, '仕込');
  INSERT INTO ctx VALUES ('site', v_site);

  -- 作業員は消せない
  PERFORM set_config('request.jwt.claim.sub', 'e2222222-2222-4222-8222-222222222222', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  BEGIN
    PERFORM public.soft_delete_sites(v_org, ARRAY[v_site]);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'workers cannot delete sites');

  -- 他社の管理者も消せない
  v_failed := false;
  PERFORM set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
  BEGIN
    PERFORM public.soft_delete_sites(v_org, ARRAY[v_site]);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'other companies cannot delete sites');

  -- 管理者は消せる
  PERFORM set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  PERFORM pg_temp.expect(public.soft_delete_sites(v_org, ARRAY[v_site]) = 1, 'admin deletes the site');
  PERFORM pg_temp.expect(public.soft_delete_sites(v_org, ARRAY[v_site]) = 0, 'deleting twice is a no-op');
  PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_site), 'deleted site is hidden');
END $$;

RESET ROLE;

DO $$
DECLARE
  v_site uuid := (SELECT value FROM ctx WHERE key = 'site');
BEGIN
  PERFORM pg_temp.expect((SELECT deleted_at IS NOT NULL FROM public.projects WHERE id = v_site), 'site is soft-deleted');
  PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.schedules WHERE project_id = v_site), 'schedules are removed');
  PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.project_progress_items WHERE project_id = v_site), 'progress items are removed');
END $$;

ROLLBACK;
