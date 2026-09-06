-- Assignment dates, work_events (confirmed graph node), audio storage, capture.confirm writes.

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_status_check;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_status_check CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS project_members_today_idx
  ON public.project_members (organization_id, membership_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

ALTER TABLE public.captures
  ADD COLUMN IF NOT EXISTS graph_applied_at timestamptz;

CREATE TABLE IF NOT EXISTS public.work_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  capture_id uuid NOT NULL REFERENCES public.captures (id),
  work_type_key text,
  work_description text,
  location text,
  issue text,
  next_action text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX work_events_capture_active
  ON public.work_events (capture_id)
  WHERE deleted_at IS NULL;

CREATE INDEX work_events_project_idx
  ON public.work_events (organization_id, project_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER work_events_set_updated_at
  BEFORE UPDATE ON public.work_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.work_events TO authenticated;

ALTER TABLE public.work_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_events_select ON public.work_events
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_can_access_project(organization_id, project_id)
  );

CREATE POLICY work_events_insert ON public.work_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_permission(organization_id, 'capture.confirm')
    AND public.auth_can_access_project(organization_id, project_id)
  );

CREATE POLICY work_events_update ON public.work_events
  FOR UPDATE TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'capture.confirm')
    AND public.auth_can_access_project(organization_id, project_id)
  );

-- Workers confirming a capture must be able to write graph facts.
CREATE POLICY incidents_insert_from_capture ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_permission(organization_id, 'capture.confirm')
    AND public.auth_can_access_project(organization_id, project_id)
  );

CREATE POLICY incident_actions_insert_from_capture ON public.incident_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'capture.confirm'));

CREATE POLICY incident_causes_insert_from_capture ON public.incident_causes
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'capture.confirm'));

CREATE POLICY project_work_types_insert_from_capture ON public.project_work_types
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_permission(organization_id, 'capture.confirm')
    AND public.auth_can_access_project(organization_id, project_id)
  );

CREATE OR REPLACE FUNCTION public.audit_project_members_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (organization_id, actor_profile_id, action, target_table, target_id, metadata)
    VALUES (
      NEW.organization_id,
      auth.uid(),
      'project_member.assign',
      'project_members',
      NEW.id,
      jsonb_build_object('project_id', NEW.project_id, 'membership_id', NEW.membership_id, 'status', NEW.status)
    );
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs (organization_id, actor_profile_id, action, target_table, target_id, metadata)
  VALUES (
    NEW.organization_id,
    auth.uid(),
    'project_member.update',
    'project_members',
    NEW.id,
    jsonb_build_object('status', NEW.status, 'starts_on', NEW.starts_on, 'ends_on', NEW.ends_on)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_members_audit ON public.project_members;
CREATE TRIGGER project_members_audit
  AFTER INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_project_members_change();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('org-files', 'org-files', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS org_files_select ON storage.objects;
DROP POLICY IF EXISTS org_files_insert ON storage.objects;
DROP POLICY IF EXISTS org_files_update ON storage.objects;

CREATE POLICY org_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-files'
    AND split_part(name, '/', 1)::uuid IN (SELECT public.auth_organization_ids())
  );

CREATE POLICY org_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-files'
    AND split_part(name, '/', 1)::uuid IN (SELECT public.auth_organization_ids())
  );

CREATE POLICY org_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-files'
    AND split_part(name, '/', 1)::uuid IN (SELECT public.auth_organization_ids())
  );
