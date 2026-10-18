-- Executable checks for 20261018120000_billing_server_only_writes.sql (local DB only).
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
  ('b1111111-1111-4111-8111-111111111111', 'billing-owner@example.test', '{"display_name":"契約テスト"}');

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value uuid);
GRANT ALL ON ctx TO authenticated, service_role;

SELECT
  set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111111', true),
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claims', '{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
-- 会社を作ると、お試し（trialing）の契約行が SECURITY DEFINER の関数で作られる
INSERT INTO ctx SELECT 'org', public.create_organization('契約検証');

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_org uuid := (SELECT value FROM ctx WHERE key = 'org');
  v_status text;
  v_failed boolean;
BEGIN
  SELECT status INTO v_status FROM public.organization_billing WHERE organization_id = v_org;
  PERFORM pg_temp.expect(v_status = 'trialing', 'owner can read own billing row (trialing)');

  v_failed := false;
  BEGIN
    UPDATE public.organization_billing SET status = 'active', trial_ends_at = NULL WHERE organization_id = v_org;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'owner cannot mark own company as paid');

  v_failed := false;
  BEGIN
    DELETE FROM public.organization_billing WHERE organization_id = v_org;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'owner cannot delete own billing row');

  v_failed := false;
  BEGIN
    INSERT INTO public.organization_billing (organization_id, plan_code, status)
    VALUES (gen_random_uuid(), 'standard', 'active');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  PERFORM pg_temp.expect(v_failed, 'owner cannot insert billing rows');

  SELECT status INTO v_status FROM public.organization_billing WHERE organization_id = v_org;
  PERFORM pg_temp.expect(v_status = 'trialing', 'billing row unchanged');
END;
$$;

RESET ROLE;

-- service_role（Webhook・サーバー）は書ける
SET LOCAL ROLE service_role;
UPDATE public.organization_billing SET status = 'active', trial_ends_at = NULL
WHERE organization_id = (SELECT value FROM ctx WHERE key = 'org');
RESET ROLE;
SELECT pg_temp.expect(
  (SELECT status FROM public.organization_billing WHERE organization_id = (SELECT value FROM ctx WHERE key = 'org')) = 'active',
  'service_role can update billing'
);

ROLLBACK;
