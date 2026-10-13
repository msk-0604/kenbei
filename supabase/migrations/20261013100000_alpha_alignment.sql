-- KENBEI: kenbei-alpha（アルファ管工版）で固まった業務仕様に寄せる。
--   ・作業予定（schedules）と作業員名簿（workers）
--   ・作業工程チェックリスト（project_progress_items / progress_item_history / 会社ごとの候補）
--   ・現場の長期／単発、完了日（completed_at）、全員へのお知らせ（published_at）
--   ・会社共通の作業員合言葉ログイン（共通ログイン用の crew ロール）と管理者の合言葉
--   ・アプリ内お知らせの重複防止（dedupe_key）と Web Push 購読
-- Additive. 既存の RLS・課金・招待の仕組みは変えない。

-- ---------------------------------------------------------------------------
-- 1) 共通ログイン用ロール（会社に1つの合言葉でログインする作業員用アカウント）
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (id, organization_id, code, name, is_system)
VALUES ('00000000-0000-4000-a000-000000000009', NULL, 'crew', 'Crew', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_code) VALUES
  ('00000000-0000-4000-a000-000000000009', 'project.read_all'),
  ('00000000-0000-4000-a000-000000000009', 'capture.create'),
  ('00000000-0000-4000-a000-000000000009', 'capture.confirm'),
  ('00000000-0000-4000-a000-000000000009', 'photo.create'),
  ('00000000-0000-4000-a000-000000000009', 'knowledge.read'),
  ('00000000-0000-4000-a000-000000000009', 'signal.feedback')
ON CONFLICT DO NOTHING;

-- 「管理者」= 現場を登録できる人（Owner / Executive / Manager / Office）
CREATE OR REPLACE FUNCTION public.auth_is_site_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_has_permission(p_org_id, 'project.create');
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_site_admin(uuid) TO authenticated;

-- 他のメンバーがその現場を見られるか（お知らせの宛先を絞るため）
CREATE OR REPLACE FUNCTION public.member_can_access_project(
  p_profile_id uuid,
  p_org_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    WHERE m.organization_id = p_org_id
      AND m.profile_id = p_profile_id
      AND m.status = 'active'
      AND m.deleted_at IS NULL
      AND rp.permission_code = 'project.read_all'
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.memberships m ON m.id = pm.membership_id
    WHERE pm.organization_id = p_org_id
      AND pm.project_id = p_project_id
      AND pm.deleted_at IS NULL
      AND m.profile_id = p_profile_id
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.membership_project_access a
    JOIN public.memberships m ON m.id = a.membership_id
    WHERE a.organization_id = p_org_id
      AND a.project_id = p_project_id
      AND a.deleted_at IS NULL
      AND m.profile_id = p_profile_id
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.member_can_access_project(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) 合言葉ログイン
-- ---------------------------------------------------------------------------
-- 会社コード：合言葉を会社ごとに区別するための6桁の番号（ログイン画面で入力、端末が覚える）
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS login_code text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_login_code_unique
  ON public.organizations (login_code)
  WHERE login_code IS NOT NULL;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_login_code_format;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_login_code_format
  CHECK (login_code IS NULL OR login_code ~ '^[0-9]{6}$');

-- 合言葉のハッシュ。サービスロール（サーバー）からだけ読み書きする。
CREATE TABLE IF NOT EXISTS public.organization_passcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  kind text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  passcode_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT organization_passcodes_kind_check CHECK (kind IN ('worker', 'admin')),
  CONSTRAINT organization_passcodes_unique UNIQUE (organization_id, kind, profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_passcodes_worker_one
  ON public.organization_passcodes (organization_id)
  WHERE kind = 'worker';

DROP TRIGGER IF EXISTS organization_passcodes_set_updated_at ON public.organization_passcodes;
CREATE TRIGGER organization_passcodes_set_updated_at
  BEFORE UPDATE ON public.organization_passcodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organization_passcodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_passcodes FROM anon, authenticated;
-- No policies: server (service role) only.

-- 共通ログインのアカウント（なければ NULL）
CREATE OR REPLACE FUNCTION public.organization_crew_profile_id(p_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.profile_id
  FROM public.organization_passcodes p
  WHERE p.organization_id = p_org_id
    AND p.kind = 'worker'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.organization_crew_profile_id(uuid) FROM PUBLIC, anon, authenticated;

-- crew ロールのメンバーシップは、その会社の共通ログイン用アカウントにだけ付けられる。
-- それ以外は 20260922140000_protect_membership_roles.sql と同じ判定。
CREATE OR REPLACE FUNCTION public.protect_membership_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code text;
  v_old_code text;
  v_existing int;
BEGIN
  SELECT r.code INTO v_new_code
  FROM public.roles r
  WHERE r.id = NEW.role_id;

  IF TG_OP = 'INSERT' THEN
    IF v_new_code = 'owner' THEN
      SELECT count(*)::int INTO v_existing
      FROM public.memberships m
      WHERE m.organization_id = NEW.organization_id
        AND m.deleted_at IS NULL;
      IF v_existing > 0 THEN
        RAISE EXCEPTION 'KENBEI_OWNER_GRANT' USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END IF;
    IF v_new_code = 'crew' THEN
      IF public.organization_crew_profile_id(NEW.organization_id) IS DISTINCT FROM NEW.profile_id THEN
        RAISE EXCEPTION 'KENBEI_INVITE_ROLE' USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END IF;
    IF NOT public.invite_role_is_allowed(NEW.role_id) THEN
      RAISE EXCEPTION 'KENBEI_INVITE_ROLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'KENBEI_ROLE_LOCKED' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    SELECT r.code INTO v_old_code
    FROM public.roles r
    WHERE r.id = OLD.role_id;
    IF v_old_code = 'owner' AND public.active_owner_count(OLD.organization_id, OLD.id) = 0 THEN
      RAISE EXCEPTION 'KENBEI_LAST_OWNER' USING ERRCODE = 'P0001';
    END IF;
    IF v_new_code = 'owner' THEN
      RAISE EXCEPTION 'KENBEI_OWNER_GRANT' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'KENBEI_ROLE_LOCKED' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    SELECT r.code INTO v_old_code
    FROM public.roles r
    WHERE r.id = OLD.role_id;
    IF v_old_code = 'owner' AND public.active_owner_count(OLD.organization_id, OLD.id) = 0 THEN
      RAISE EXCEPTION 'KENBEI_LAST_OWNER' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) 現場（projects）：長期／単発・完了日・お知らせ済み・担当者など
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS work_duration text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS prime_contractor_name text,
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS progress_remarks text;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_work_duration_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_work_duration_check
  CHECK (work_duration IS NULL OR work_duration IN ('long_term', 'one_off'));

-- 完了以外 → 完了：今の時刻 / 完了 → 完了以外：消す / それ以外：変えない
CREATE OR REPLACE FUNCTION public.projects_track_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
  ELSIF NEW.status IS DISTINCT FROM 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_completed_at ON public.projects;
CREATE TRIGGER projects_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_track_completed_at();

UPDATE public.projects
SET completed_at = COALESCE(actual_end_on::timestamptz, updated_at)
WHERE status = 'completed'
  AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_org_completed_at
  ON public.projects (organization_id, completed_at DESC)
  WHERE deleted_at IS NULL AND status = 'completed';

-- ---------------------------------------------------------------------------
-- 4) 作業員名簿（アカウントを持たない作業員も予定に割り当てられる）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  phone text,
  trade text,
  status text NOT NULL DEFAULT 'active',
  membership_id uuid REFERENCES public.memberships (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) DEFAULT auth.uid(),
  CONSTRAINT workers_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT workers_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT workers_phone_check CHECK (phone IS NULL OR char_length(phone) <= 30)
);

CREATE INDEX IF NOT EXISTS workers_org_name ON public.workers (organization_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS workers_org_membership
  ON public.workers (organization_id, membership_id)
  WHERE membership_id IS NOT NULL;

DROP TRIGGER IF EXISTS workers_set_updated_at ON public.workers;
CREATE TRIGGER workers_set_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.workers_check_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.id = NEW.membership_id
      AND m.organization_id = NEW.organization_id
      AND m.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workers_scope ON public.workers;
CREATE TRIGGER workers_scope
  BEFORE INSERT OR UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.workers_check_scope();

-- ---------------------------------------------------------------------------
-- 5) 作業予定
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.workers (id) ON DELETE SET NULL,
  schedule_date date NOT NULL,
  client_company_name text,
  location text,
  title text,
  work_content text,
  scheduled_start_time time,
  scheduled_end_time time,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  memo text,
  status text NOT NULL DEFAULT 'scheduled',
  group_id uuid,
  time_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) DEFAULT auth.uid(),
  CONSTRAINT schedules_status_check
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT schedules_time_kind_check
    CHECK (time_kind IS NULL OR time_kind IN ('timed', 'am', 'pm', 'unset')),
  CONSTRAINT schedules_text_length_check CHECK (
    char_length(coalesce(work_content, '')) <= 2000
    AND char_length(coalesce(memo, '')) <= 2000
    AND char_length(coalesce(client_company_name, '')) <= 200
    AND char_length(coalesce(location, '')) <= 500
    AND char_length(coalesce(title, '')) <= 200
  )
);

CREATE INDEX IF NOT EXISTS schedules_org_date ON public.schedules (organization_id, schedule_date);
CREATE INDEX IF NOT EXISTS schedules_project_date ON public.schedules (project_id, schedule_date);
CREATE INDEX IF NOT EXISTS schedules_worker ON public.schedules (worker_id) WHERE worker_id IS NOT NULL;

DROP TRIGGER IF EXISTS schedules_set_updated_at ON public.schedules;
CREATE TRIGGER schedules_set_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.schedules_check_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = NEW.project_id
      AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.worker_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = NEW.worker_id
      AND w.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedules_scope ON public.schedules;
CREATE TRIGGER schedules_scope
  BEFORE INSERT OR UPDATE OF organization_id, project_id, worker_id ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.schedules_check_scope();

-- 作業開始・終了は、予定を見られる人なら誰でも押せる（共通ログインの作業員を含む）。
CREATE OR REPLACE FUNCTION public.record_schedule_work(p_schedule_id uuid, p_action text)
RETURNS public.schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.schedules;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_action NOT IN ('start', 'end') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_row
  FROM public.schedules s
  WHERE s.id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.auth_is_org_member(v_row.organization_id)
     OR NOT public.auth_can_access_project(v_row.organization_id, v_row.project_id) THEN
    RAISE EXCEPTION 'not found';
  END IF;

  IF v_row.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'KENBEI_SCHEDULE_CLOSED' USING ERRCODE = 'P0001';
  END IF;

  IF p_action = 'start' THEN
    UPDATE public.schedules
    SET actual_start_time = COALESCE(actual_start_time, now()),
        status = 'in_progress'
    WHERE id = p_schedule_id
    RETURNING * INTO v_row;
  ELSE
    IF v_row.actual_start_time IS NULL AND v_row.status <> 'in_progress' THEN
      RAISE EXCEPTION 'KENBEI_SCHEDULE_NOT_STARTED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.schedules
    SET actual_end_time = now(),
        status = 'completed'
    WHERE id = p_schedule_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_schedule_work(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_schedule_work(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) 作業工程チェックリスト
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_progress_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'その他',
  section text,
  item_name text NOT NULL,
  mark text NOT NULL DEFAULT 'none',
  -- mark が正。checked / status は読み取り用に自動で決まる。
  checked boolean GENERATED ALWAYS AS (mark = 'ok') STORED,
  status text GENERATED ALWAYS AS (
    CASE WHEN mark = 'ok' THEN 'completed' WHEN mark = 'attention' THEN 'attention' ELSE 'pending' END
  ) STORED,
  remarks text,
  checked_at timestamptz,
  checked_by uuid REFERENCES public.profiles (id),
  -- 共通ログインでは checked_by が全員同じなので、端末で選んだ名前も残す
  checked_by_name text,
  sort_order int NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) DEFAULT auth.uid(),
  CONSTRAINT project_progress_items_mark_check CHECK (mark IN ('none', 'ok', 'attention')),
  CONSTRAINT project_progress_items_name_check CHECK (
    char_length(btrim(item_name)) BETWEEN 1 AND 120
    AND char_length(category) <= 60
    AND char_length(coalesce(section, '')) <= 60
    AND char_length(coalesce(remarks, '')) <= 2000
  )
);

CREATE INDEX IF NOT EXISTS project_progress_items_project
  ON public.project_progress_items (project_id, sort_order);
CREATE INDEX IF NOT EXISTS project_progress_items_org
  ON public.project_progress_items (organization_id);

DROP TRIGGER IF EXISTS project_progress_items_set_updated_at ON public.project_progress_items;
CREATE TRIGGER project_progress_items_set_updated_at
  BEFORE UPDATE ON public.project_progress_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.progress_item_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.project_progress_items (id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.profiles (id),
  actor_name text,
  previous_mark text,
  next_mark text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progress_item_history_item
  ON public.progress_item_history (item_id, changed_at DESC);

-- 項目の追加・削除・並び替えは現場を見られる記録係（作業員を含む）もできる。
-- 項目名・分類の書き換えは管理者だけ。〇/△は set_progress_mark() 経由だけ。
CREATE OR REPLACE FUNCTION public.guard_progress_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id
        AND p.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
    END IF;
    NEW.mark := 'none';
    NEW.version := 1;
    NEW.checked_at := NULL;
    NEW.checked_by := NULL;
    NEW.checked_by_name := NULL;
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'KENBEI_ORG_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  IF current_setting('kenbei.progress_write', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.mark IS DISTINCT FROM OLD.mark
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.checked_at IS DISTINCT FROM OLD.checked_at
     OR NEW.checked_by IS DISTINCT FROM OLD.checked_by
     OR NEW.checked_by_name IS DISTINCT FROM OLD.checked_by_name THEN
    RAISE EXCEPTION 'use set_progress_mark';
  END IF;

  IF (NEW.category IS DISTINCT FROM OLD.category
      OR NEW.section IS DISTINCT FROM OLD.section
      OR NEW.item_name IS DISTINCT FROM OLD.item_name)
     AND NOT public.auth_is_site_admin(OLD.organization_id) THEN
    RAISE EXCEPTION 'workers cannot change process definitions';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS progress_items_guard ON public.project_progress_items;
CREATE TRIGGER progress_items_guard
  BEFORE INSERT OR UPDATE ON public.project_progress_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_progress_items();

CREATE OR REPLACE FUNCTION public.set_progress_mark(
  p_item_id uuid,
  p_mark text,
  p_expected_version integer,
  p_actor_name text DEFAULT NULL
)
RETURNS public.project_progress_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.project_progress_items;
  v_updated public.project_progress_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_mark NOT IN ('ok', 'attention') THEN
    RAISE EXCEPTION 'invalid mark';
  END IF;

  SELECT * INTO v_current
  FROM public.project_progress_items i
  WHERE i.id = p_item_id;

  IF NOT FOUND
     OR NOT public.auth_is_org_member(v_current.organization_id)
     OR NOT public.auth_can_access_project(v_current.organization_id, v_current.project_id) THEN
    RAISE EXCEPTION 'not found';
  END IF;

  IF NOT (
    public.auth_has_permission(v_current.organization_id, 'capture.confirm')
    OR public.auth_has_permission(v_current.organization_id, 'project.update')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF v_current.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'conflict';
  END IF;

  PERFORM set_config('kenbei.progress_write', '1', true);

  UPDATE public.project_progress_items
  SET mark = p_mark,
      checked_at = now(),
      checked_by = auth.uid(),
      checked_by_name = NULLIF(left(btrim(coalesce(p_actor_name, '')), 40), ''),
      version = version + 1
  WHERE id = p_item_id
    AND version = p_expected_version
  RETURNING * INTO v_updated;

  PERFORM set_config('kenbei.progress_write', '', true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conflict';
  END IF;

  INSERT INTO public.progress_item_history (
    organization_id, project_id, item_id, changed_by, actor_name, previous_mark, next_mark
  ) VALUES (
    v_current.organization_id,
    v_current.project_id,
    v_current.id,
    auth.uid(),
    NULLIF(left(btrim(coalesce(p_actor_name, '')), 40), ''),
    v_current.mark,
    p_mark
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.set_progress_mark(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_progress_mark(uuid, text, integer, text) TO authenticated;

-- 会社ごとの「よく使う項目」。空なら画面側の標準候補（水道・管工事）を使う。
CREATE TABLE IF NOT EXISTS public.progress_item_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  category text NOT NULL DEFAULT 'その他',
  section text,
  item_name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) DEFAULT auth.uid(),
  CONSTRAINT progress_item_presets_name_check CHECK (
    char_length(btrim(item_name)) BETWEEN 1 AND 120
    AND char_length(category) <= 60
    AND char_length(coalesce(section, '')) <= 60
  )
);

CREATE INDEX IF NOT EXISTS progress_item_presets_org
  ON public.progress_item_presets (organization_id, sort_order);

-- ---------------------------------------------------------------------------
-- 7) アプリ内お知らせ（既存の notifications に重複防止と宛先ルールを足す）
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_profile_dedupe
  ON public.notifications (profile_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 既読にする以外の書き換えはできない
CREATE OR REPLACE FUNCTION public.protect_notification_body()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.href IS DISTINCT FROM OLD.href
     OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key THEN
    RAISE EXCEPTION 'notices are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_protect ON public.notifications;
CREATE TRIGGER notifications_protect
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_notification_body();

-- 会社のメンバー（共通ログインを含む）へお知らせを入れ、届け先の profile_id を返す。
-- 操作した本人には届かない。p_include_actor = true のとき（現場の完了）だけ本人にも届く。
-- 現場に紐づくお知らせは、その現場を見られる人にだけ届く。
CREATE OR REPLACE FUNCTION public.post_org_notice(
  p_organization_id uuid,
  p_project_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text,
  p_dedupe_key text,
  p_include_actor boolean DEFAULT false
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_href text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'not an organization member';
  END IF;
  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND p.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF p_project_id IS NOT NULL
     AND NOT public.auth_can_access_project(p_organization_id, p_project_id) THEN
    RAISE EXCEPTION 'not found';
  END IF;
  -- 本人にも届けるのは「現場を完了にした」管理者だけ
  IF p_include_actor AND NOT public.auth_is_site_admin(p_organization_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  v_key := left(COALESCE(NULLIF(btrim(p_dedupe_key), ''), p_kind || ':' || gen_random_uuid()::text), 160);
  v_href := CASE WHEN p_href LIKE '/%' AND p_href NOT LIKE '//%' THEN left(p_href, 300) ELSE NULL END;

  RETURN QUERY
  WITH recipients AS (
    SELECT DISTINCT m.profile_id
    FROM public.memberships m
    WHERE m.organization_id = p_organization_id
      AND m.status = 'active'
      AND m.deleted_at IS NULL
      AND (p_include_actor OR m.profile_id <> auth.uid())
      AND (
        p_project_id IS NULL
        OR public.member_can_access_project(m.profile_id, p_organization_id, p_project_id)
      )
  ),
  inserted AS (
    INSERT INTO public.notifications (
      organization_id, profile_id, project_id, kind, title, body, href, dedupe_key
    )
    SELECT
      p_organization_id,
      r.profile_id,
      p_project_id,
      left(p_kind, 40),
      left(btrim(p_title), 80),
      NULLIF(left(btrim(coalesce(p_body, '')), 200), ''),
      v_href,
      v_key
    FROM recipients r
    ON CONFLICT (profile_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING profile_id
  )
  SELECT inserted.profile_id FROM inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.post_org_notice(uuid, uuid, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_org_notice(uuid, uuid, text, text, text, text, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Web Push 購読（ブラウザ / ホーム画面に追加したアプリ）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT push_subscriptions_endpoint_check CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) <= 1000)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_org_profile
  ON public.push_subscriptions (organization_id, profile_id);

DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9) Grants + RLS
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_progress_items TO authenticated;
GRANT SELECT ON public.progress_item_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_item_presets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.progress_item_history FROM authenticated;

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_item_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_item_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- workers: 会社のメンバーは見られる。登録・変更は管理者だけ。
DROP POLICY IF EXISTS workers_select ON public.workers;
CREATE POLICY workers_select ON public.workers
  FOR SELECT TO authenticated
  USING (public.auth_is_org_member(organization_id));

DROP POLICY IF EXISTS workers_insert ON public.workers;
CREATE POLICY workers_insert ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_site_admin(organization_id));

DROP POLICY IF EXISTS workers_update ON public.workers;
CREATE POLICY workers_update ON public.workers
  FOR UPDATE TO authenticated
  USING (public.auth_is_site_admin(organization_id))
  WITH CHECK (public.auth_is_site_admin(organization_id));

DROP POLICY IF EXISTS workers_delete ON public.workers;
CREATE POLICY workers_delete ON public.workers
  FOR DELETE TO authenticated
  USING (public.auth_is_site_admin(organization_id));

-- schedules: 現場を見られる人は見られる。登録・変更・削除は管理者だけ。
DROP POLICY IF EXISTS schedules_select ON public.schedules;
CREATE POLICY schedules_select ON public.schedules
  FOR SELECT TO authenticated
  USING (
    public.auth_is_org_member(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  );

DROP POLICY IF EXISTS schedules_insert ON public.schedules;
CREATE POLICY schedules_insert ON public.schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_site_admin(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  );

DROP POLICY IF EXISTS schedules_update ON public.schedules;
CREATE POLICY schedules_update ON public.schedules
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_site_admin(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  )
  WITH CHECK (
    public.auth_is_site_admin(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  );

DROP POLICY IF EXISTS schedules_delete ON public.schedules;
CREATE POLICY schedules_delete ON public.schedules
  FOR DELETE TO authenticated
  USING (
    public.auth_is_site_admin(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  );

-- progress items: 現場を見られる記録係は追加・削除・並び替えができる。
DROP POLICY IF EXISTS progress_items_select ON public.project_progress_items;
CREATE POLICY progress_items_select ON public.project_progress_items
  FOR SELECT TO authenticated
  USING (
    public.auth_is_org_member(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  );

DROP POLICY IF EXISTS progress_items_insert ON public.project_progress_items;
CREATE POLICY progress_items_insert ON public.project_progress_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_access_project(organization_id, project_id)
    AND (
      public.auth_has_permission(organization_id, 'capture.confirm')
      OR public.auth_has_permission(organization_id, 'project.update')
    )
  );

DROP POLICY IF EXISTS progress_items_update ON public.project_progress_items;
CREATE POLICY progress_items_update ON public.project_progress_items
  FOR UPDATE TO authenticated
  USING (
    public.auth_can_access_project(organization_id, project_id)
    AND (
      public.auth_has_permission(organization_id, 'capture.confirm')
      OR public.auth_has_permission(organization_id, 'project.update')
    )
  )
  WITH CHECK (public.auth_can_access_project(organization_id, project_id));

DROP POLICY IF EXISTS progress_items_delete ON public.project_progress_items;
CREATE POLICY progress_items_delete ON public.project_progress_items
  FOR DELETE TO authenticated
  USING (
    public.auth_can_access_project(organization_id, project_id)
    AND (
      public.auth_has_permission(organization_id, 'capture.confirm')
      OR public.auth_has_permission(organization_id, 'project.update')
    )
  );

DROP POLICY IF EXISTS progress_history_select ON public.progress_item_history;
CREATE POLICY progress_history_select ON public.progress_item_history
  FOR SELECT TO authenticated
  USING (
    public.auth_is_org_member(organization_id)
    AND public.auth_can_access_project(organization_id, project_id)
  );

-- presets: 会社のメンバーは見られる。編集は管理者だけ。
DROP POLICY IF EXISTS progress_presets_select ON public.progress_item_presets;
CREATE POLICY progress_presets_select ON public.progress_item_presets
  FOR SELECT TO authenticated
  USING (public.auth_is_org_member(organization_id));

DROP POLICY IF EXISTS progress_presets_write ON public.progress_item_presets;
CREATE POLICY progress_presets_write ON public.progress_item_presets
  FOR ALL TO authenticated
  USING (public.auth_is_site_admin(organization_id))
  WITH CHECK (public.auth_is_site_admin(organization_id));

-- push subscriptions: 自分の端末の購読だけ
DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (profile_id = auth.uid() AND public.auth_is_org_member(organization_id))
  WITH CHECK (profile_id = auth.uid() AND public.auth_is_org_member(organization_id));
