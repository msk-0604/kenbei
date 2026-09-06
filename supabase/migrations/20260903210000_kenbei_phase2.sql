-- KENBEI Phase 2: billing plans, push tokens, project chat, drawings metadata,
-- export jobs, decision signals helpers, security tightenings.
-- Does not disable RLS. Safe additive migration.

-- ---------------------------------------------------------------------------
-- Billing / entitlement (prices configurable; Stripe IDs optional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  max_members int,
  monthly_price_jpy int NOT NULL DEFAULT 0,
  stripe_price_id text,
  sort_order int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_plans (code, name, max_members, monthly_price_jpy, sort_order, features)
VALUES
  ('free', 'FREE', 3, 0, 10, '{"export":true,"chat":true,"push":true}'::jsonb),
  ('team', 'TEAM', 10, 19800, 20, '{"export":true,"chat":true,"push":true}'::jsonb),
  ('pro', 'PRO', 30, 39800, 30, '{"export":true,"chat":true,"push":true}'::jsonb),
  ('business', 'BUSINESS', 50, 59800, 40, '{"export":true,"chat":true,"push":true}'::jsonb),
  ('enterprise', 'ENTERPRISE', NULL, 0, 50, '{"export":true,"chat":true,"push":true,"custom":true}'::jsonb)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.organization_billing (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id),
  plan_code text NOT NULL DEFAULT 'free' REFERENCES public.billing_plans (code),
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  data_retention_days int NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_billing_status_check
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'))
);

DROP TRIGGER IF EXISTS organization_billing_set_updated_at ON public.organization_billing;
CREATE TRIGGER organization_billing_set_updated_at
  BEFORE UPDATE ON public.organization_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill free billing for existing orgs
INSERT INTO public.organization_billing (organization_id, plan_code, status)
SELECT id, 'free', 'active'
FROM public.organizations
WHERE deleted_at IS NULL
ON CONFLICT (organization_id) DO NOTHING;

-- Align organizations.plan text with billing (keep column for backward compat)
UPDATE public.organizations o
SET plan = COALESCE(b.plan_code, 'free')
FROM public.organization_billing b
WHERE b.organization_id = o.id;

-- ---------------------------------------------------------------------------
-- Push device tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown',
  expo_push_token text,
  device_name text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT push_tokens_platform_check
    CHECK (platform IN ('ios', 'android', 'web', 'unknown'))
);

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_active
  ON public.push_tokens (token)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS push_tokens_profile
  ON public.push_tokens (organization_id, profile_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Project chat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  sender_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  body text NOT NULL DEFAULT '',
  attachment_storage_path text,
  photo_id uuid REFERENCES public.photos (id),
  document_id uuid REFERENCES public.documents (id),
  mention_profile_ids uuid[] NOT NULL DEFAULT '{}',
  search_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS project_messages_project_created
  ON public.project_messages (organization_id, project_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS project_messages_search_trgm
  ON public.project_messages USING gin (search_text gin_trgm_ops);

DROP TRIGGER IF EXISTS project_messages_set_updated_at ON public.project_messages;
CREATE TRIGGER project_messages_set_updated_at
  BEFORE UPDATE ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.project_messages_set_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := trim(both from concat_ws(' ', NEW.body, array_to_string(NEW.mention_profile_ids::text[], ' ')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_messages_search_bi ON public.project_messages;
CREATE TRIGGER project_messages_search_bi
  BEFORE INSERT OR UPDATE OF body, mention_profile_ids ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.project_messages_set_search_text();

-- ---------------------------------------------------------------------------
-- Drawing / document versioning
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.documents (id),
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_category_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_category_check
  CHECK (category IN ('drawing', 'safety', 'rule', 'technical', 'case', 'report', 'other'));

-- Map legacy kind → category
UPDATE public.documents
SET category = kind
WHERE kind IN ('safety', 'rule', 'technical', 'case', 'other');

DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS documents_project_latest
  ON public.documents (organization_id, project_id, category, is_latest)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Export jobs (background)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  requested_by uuid NOT NULL REFERENCES public.profiles (id),
  status text NOT NULL DEFAULT 'queued',
  format text NOT NULL DEFAULT 'json',
  include_files boolean NOT NULL DEFAULT false,
  scopes text[] NOT NULL DEFAULT ARRAY[
    'projects','photos','documents','reports','tasks','processes','chat','members'
  ],
  result_storage_path text,
  result_bytes bigint,
  error_message text,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT export_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'expired')),
  CONSTRAINT export_jobs_format_check
    CHECK (format IN ('json', 'csv', 'zip'))
);

CREATE INDEX IF NOT EXISTS export_jobs_org_created
  ON public.export_jobs (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS export_jobs_set_updated_at ON public.export_jobs;
CREATE TRIGGER export_jobs_set_updated_at
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Onboarding checklist state (org settings)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Preferred organization (multi-org ready)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_organization_id uuid REFERENCES public.organizations (id);

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_billing TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.export_jobs TO authenticated;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_plans_select ON public.billing_plans
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY organization_billing_select ON public.organization_billing
  FOR SELECT TO authenticated
  USING (public.auth_is_org_member(organization_id));

CREATE POLICY organization_billing_update ON public.organization_billing
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));

CREATE POLICY organization_billing_insert ON public.organization_billing
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));

CREATE POLICY push_tokens_select ON public.push_tokens
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  );

CREATE POLICY push_tokens_insert ON public.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  );

CREATE POLICY push_tokens_update ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND public.auth_is_org_member(organization_id))
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY project_messages_select ON public.project_messages
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_can_access_project(organization_id, project_id)
  );

CREATE POLICY project_messages_insert ON public.project_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_profile_id = auth.uid()
    AND public.auth_can_access_project(organization_id, project_id)
  );

CREATE POLICY project_messages_update ON public.project_messages
  FOR UPDATE TO authenticated
  USING (
    sender_profile_id = auth.uid()
    AND public.auth_can_access_project(organization_id, project_id)
  )
  WITH CHECK (sender_profile_id = auth.uid());

CREATE POLICY export_jobs_select ON public.export_jobs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (
      requested_by = auth.uid()
      OR public.auth_has_permission(organization_id, 'org.manage')
    )
  );

CREATE POLICY export_jobs_insert ON public.export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.auth_has_permission(organization_id, 'org.manage')
  );

CREATE POLICY export_jobs_update ON public.export_jobs
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));

-- Tighten notification insert: self OR privileged via SECURITY DEFINER helper only
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_org_member(organization_id)
    AND profile_id = auth.uid()
  );

-- Server-side notify for other users (service role / definer)
CREATE OR REPLACE FUNCTION public.create_notification_for_member(
  p_organization_id uuid,
  p_profile_id uuid,
  p_project_id uuid,
  p_kind text,
  p_title text,
  p_body text DEFAULT NULL,
  p_href text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.auth_has_permission(p_organization_id, 'project.update')
     AND NOT public.auth_has_permission(p_organization_id, 'org.manage')
     AND auth.uid() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'not allowed to notify other members';
  END IF;
  IF NOT public.auth_is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'not an organization member';
  END IF;

  INSERT INTO public.notifications (
    organization_id, profile_id, project_id, kind, title, body, href
  ) VALUES (
    p_organization_id, p_profile_id, p_project_id, p_kind, p_title, p_body, p_href
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_member TO authenticated;

-- Storage: require project path when uploading under /projects/
DROP POLICY IF EXISTS org_files_select ON storage.objects;
DROP POLICY IF EXISTS org_files_insert ON storage.objects;
DROP POLICY IF EXISTS org_files_update ON storage.objects;

CREATE POLICY org_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-files'
    AND split_part(name, '/', 1)::uuid IN (SELECT public.auth_organization_ids())
    AND (
      split_part(name, '/', 2) IN ('documents', 'branding', 'exports')
      OR (
        split_part(name, '/', 2) = 'projects'
        AND split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
        AND public.auth_can_access_project(
          split_part(name, '/', 1)::uuid,
          split_part(name, '/', 3)::uuid
        )
      )
    )
  );

CREATE POLICY org_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-files'
    AND split_part(name, '/', 1)::uuid IN (SELECT public.auth_organization_ids())
    AND (
      split_part(name, '/', 2) IN ('documents', 'branding', 'exports')
      OR (
        split_part(name, '/', 2) = 'projects'
        AND split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
        AND public.auth_can_access_project(
          split_part(name, '/', 1)::uuid,
          split_part(name, '/', 3)::uuid
        )
      )
    )
  );

CREATE POLICY org_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-files'
    AND split_part(name, '/', 1)::uuid IN (SELECT public.auth_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- Deterministic decision signals helper view (read model; not a table write)
-- Used by app / Decision Engine foundation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ops_attention_items
WITH (security_invoker = true)
AS
SELECT
  t.organization_id,
  t.project_id,
  'overdue_task'::text AS kind,
  t.id::text AS ref_id,
  t.title AS title,
  'high'::text AS severity,
  t.due_on::text AS evidence
FROM public.project_tasks t
WHERE t.deleted_at IS NULL
  AND t.status <> 'done'
  AND t.due_on IS NOT NULL
  AND t.due_on < CURRENT_DATE
UNION ALL
SELECT
  p.organization_id,
  p.project_id,
  'delayed_process'::text,
  p.id::text,
  p.name,
  'high'::text,
  COALESCE(p.planned_end_on::text, '')
FROM public.processes p
WHERE p.deleted_at IS NULL
  AND p.status = 'delayed'
UNION ALL
SELECT
  r.organization_id,
  r.project_id,
  'unconfirmed_report'::text,
  r.id::text,
  '日報下書き'::text,
  'medium'::text,
  r.work_on::text
FROM public.daily_reports r
WHERE r.deleted_at IS NULL
  AND r.status = 'draft'
UNION ALL
SELECT
  ph.organization_id,
  ph.project_id,
  'pending_photo_confirm'::text,
  ph.id::text,
  COALESCE(ph.original_filename, '写真'),
  'medium'::text,
  ph.classification_status
FROM public.photos ph
WHERE ph.deleted_at IS NULL
  AND ph.classification_status = 'proposed';

GRANT SELECT ON public.ops_attention_items TO authenticated;

-- Ensure new orgs get free billing row
CREATE OR REPLACE FUNCTION public.ensure_organization_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_billing (organization_id, plan_code, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_ensure_billing ON public.organizations;
CREATE TRIGGER organizations_ensure_billing
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.ensure_organization_billing();
