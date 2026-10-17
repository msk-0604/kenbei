-- 顔認証・指紋（パスキー / WebAuthn）でのログイン。
-- 公開鍵だけを保存する（顔や指紋のデータは端末から出ない）。
-- 書き込みはサーバー（サービスロール）だけ。本人は自分の登録を見て消せる。

CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT user_passkeys_device_name_check CHECK (device_name IS NULL OR char_length(device_name) <= 60)
);

CREATE INDEX IF NOT EXISTS user_passkeys_profile ON public.user_passkeys (profile_id, created_at DESC);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_passkeys_select_own ON public.user_passkeys;
CREATE POLICY user_passkeys_select_own ON public.user_passkeys
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS user_passkeys_delete_own ON public.user_passkeys;
CREATE POLICY user_passkeys_delete_own ON public.user_passkeys
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

REVOKE INSERT, UPDATE ON public.user_passkeys FROM anon, authenticated;
GRANT SELECT, DELETE ON public.user_passkeys TO authenticated;

-- 登録・ログインの「チャレンジ」（1回だけ・5分で失効）。サービスロールだけが使う。
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webauthn_challenges_kind_check CHECK (kind IN ('register', 'login'))
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_expires ON public.webauthn_challenges (expires_at);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webauthn_challenges FROM anon, authenticated;
