-- KENBEI Phase 2-4: push tokens + drawing series + stricter notify membership checks.

-- ---------------------------------------------------------------------------
-- Push tokens (Expo). RLS: a user may only see/write their own rows in orgs they belong to.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  device_id text NOT NULL,
  token text NOT NULL,
  platform text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios', 'android', 'web')),
  CONSTRAINT push_tokens_device_unique UNIQUE (organization_id, profile_id, device_id)
);

-- Phase 2 already created push_tokens without device_id / active / updated_at.
-- CREATE TABLE IF NOT EXISTS is a no-op on that table; add columns before indexes.
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS push_tokens_delivery
  ON public.push_tokens (organization_id, profile_id)
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_active
  ON public.push_tokens (token)
  WHERE active = true;

DROP TRIGGER IF EXISTS push_tokens_set_updated_at ON public.push_tokens;
CREATE TRIGGER push_tokens_set_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.push_tokens TO authenticated;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_tokens_select ON public.push_tokens;
CREATE POLICY push_tokens_select ON public.push_tokens
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  );

DROP POLICY IF EXISTS push_tokens_insert ON public.push_tokens;
CREATE POLICY push_tokens_insert ON public.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  );

DROP POLICY IF EXISTS push_tokens_update ON public.push_tokens;
CREATE POLICY push_tokens_update ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (
    profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  );

-- ---------------------------------------------------------------------------
-- Drawing series (reuse documents; category = drawing)
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS series_id uuid;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS drawing_kind text;

UPDATE public.documents
SET series_id = id
WHERE series_id IS NULL;

ALTER TABLE public.documents
  ALTER COLUMN series_id SET DEFAULT gen_random_uuid();

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_drawing_kind_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_drawing_kind_check
  CHECK (drawing_kind IS NULL OR drawing_kind IN ('plan', 'elevation', 'section', 'detail', 'other'));

CREATE INDEX IF NOT EXISTS documents_series_latest
  ON public.documents (organization_id, project_id, series_id, is_latest)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Notify: target must be an active member of the SAME organization.
-- ---------------------------------------------------------------------------
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
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.auth_is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'not an organization member';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = p_organization_id
      AND m.profile_id = p_profile_id
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'target is not a member of this organization';
  END IF;
  IF v_uid IS DISTINCT FROM p_profile_id
     AND NOT public.auth_has_permission(p_organization_id, 'project.update')
     AND NOT public.auth_has_permission(p_organization_id, 'org.manage')
     AND NOT public.auth_has_permission(p_organization_id, 'capture.confirm')
     AND NOT public.auth_has_permission(p_organization_id, 'capture.create')
     AND NOT public.auth_has_permission(p_organization_id, 'photo.create')
     AND NOT public.auth_has_permission(p_organization_id, 'member.manage') THEN
    RAISE EXCEPTION 'not allowed to notify other members';
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

REVOKE ALL ON FUNCTION public.create_notification_for_member(
  uuid, uuid, uuid, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_member(
  uuid, uuid, uuid, text, text, text, text
) TO authenticated;
