-- Executable checks for 20261018100000_passkeys.sql (local DB only).
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

INSERT INTO auth.users (id, email) VALUES
  ('f1111111-1111-4111-8111-111111111111', 'passkey-1@example.test'),
  ('f2222222-2222-4222-8222-222222222222', 'passkey-2@example.test');
INSERT INTO public.user_passkeys (profile_id, credential_id, public_key) VALUES
  ('f1111111-1111-4111-8111-111111111111', 'cred-1', 'pk1'),
  ('f2222222-2222-4222-8222-222222222222', 'cred-2', 'pk2');
INSERT INTO public.webauthn_challenges (kind, challenge) VALUES ('login', 'abc');

SELECT
  set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true),
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  n int;
  v_denied boolean;
BEGIN
  SELECT count(*) INTO n FROM public.user_passkeys;
  PERFORM pg_temp.expect(n = 1, 'users only see their own passkeys');

  v_denied := false;
  BEGIN
    INSERT INTO public.user_passkeys (profile_id, credential_id, public_key) VALUES (auth.uid(), 'x', 'y');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM pg_temp.expect(v_denied, 'users cannot add passkeys directly (server verifies first)');

  v_denied := false;
  BEGIN
    UPDATE public.user_passkeys SET counter = 99;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM pg_temp.expect(v_denied, 'users cannot change the signature counter');

  v_denied := false;
  BEGIN
    PERFORM * FROM public.webauthn_challenges;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  PERFORM pg_temp.expect(v_denied, 'challenges are server-only');

  DELETE FROM public.user_passkeys WHERE credential_id = 'cred-2';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.expect(n = 0, 'users cannot remove other users'' passkeys');

  DELETE FROM public.user_passkeys WHERE credential_id = 'cred-1';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.expect(n = 1, 'users can remove their own passkey');
END $$;

ROLLBACK;
