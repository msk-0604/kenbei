-- Site ops: photo metadata, structured daily reports, tasks, process progress, notifications.
-- Extends existing tables. Does not replace RBAC or tenant helpers.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS logo_storage_path text,
  ADD COLUMN IF NOT EXISTS company_display_name text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS caution_note text;

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS work_type_key text,
  ADD COLUMN IF NOT EXISTS location_spot text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proposed_work_type_key text,
  ADD COLUMN IF NOT EXISTS proposed_location_spot text,
  ADD COLUMN IF NOT EXISTS proposed_description text,
  ADD COLUMN IF NOT EXISTS proposed_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS original_filename text;

ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_classification_status_check;
ALTER TABLE public.photos
  ADD CONSTRAINT photos_classification_status_check
  CHECK (classification_status IN ('none', 'proposed', 'confirmed'));

-- search_text must not be GENERATED: concat_ws / array_to_string are STABLE,
-- so PostgreSQL rejects GENERATED ALWAYS (SQLSTATE 42P17). Same pattern as project_messages.
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS search_text text;

CREATE OR REPLACE FUNCTION public.photos_set_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := trim(both from concat_ws(
    ' ',
    NEW.location_text,
    NEW.location_spot,
    NEW.floor,
    NEW.area,
    NEW.comment,
    NEW.work_type_key,
    NEW.category_key,
    array_to_string(NEW.tags, ' ')
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS photos_search_bi ON public.photos;
CREATE TRIGGER photos_search_bi
  BEFORE INSERT OR UPDATE OF
    location_text, location_spot, floor, area, comment,
    work_type_key, category_key, tags
  ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.photos_set_search_text();

UPDATE public.photos
SET search_text = trim(both from concat_ws(
  ' ',
  location_text,
  location_spot,
  floor,
  area,
  comment,
  work_type_key,
  category_key,
  array_to_string(tags, ' ')
))
WHERE search_text IS NULL;

CREATE INDEX IF NOT EXISTS photos_search_trgm
  ON public.photos USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS photos_org_work_type
  ON public.photos (organization_id, work_type_key)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS photos_org_captured_by
  ON public.photos (organization_id, captured_by, taken_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS weather text,
  ADD COLUMN IF NOT EXISTS work_location text,
  ADD COLUMN IF NOT EXISTS worker_count numeric,
  ADD COLUMN IF NOT EXISTS partner_companies_text text,
  ADD COLUMN IF NOT EXISTS equipment_text text,
  ADD COLUMN IF NOT EXISTS progress_note text,
  ADD COLUMN IF NOT EXISTS issues text,
  ADD COLUMN IF NOT EXISTS safety_notes text,
  ADD COLUMN IF NOT EXISTS tomorrow_plan text,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS draft_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.profiles (id);

ALTER TABLE public.daily_reports
  DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE public.daily_reports
  ADD CONSTRAINT daily_reports_status_check
  CHECK (status IN ('draft', 'confirmed'));

CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_project_day_active
  ON public.daily_reports (organization_id, project_id, work_on)
  WHERE deleted_at IS NULL;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS actual_start_on date,
  ADD COLUMN IF NOT EXISTS actual_end_on date,
  ADD COLUMN IF NOT EXISTS percent int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS assignee_membership_id uuid REFERENCES public.memberships (id);

ALTER TABLE public.processes
  DROP CONSTRAINT IF EXISTS processes_percent_check;
ALTER TABLE public.processes
  ADD CONSTRAINT processes_percent_check CHECK (percent >= 0 AND percent <= 100);

ALTER TABLE public.processes
  DROP CONSTRAINT IF EXISTS processes_status_check;
ALTER TABLE public.processes
  ADD CONSTRAINT processes_status_check
  CHECK (status IN ('not_started', 'in_progress', 'delayed', 'completed'));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_kind_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_kind_check
  CHECK (kind IN ('safety', 'rule', 'technical', 'case', 'other'));

CREATE TABLE IF NOT EXISTS public.daily_report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  report_id uuid NOT NULL REFERENCES public.daily_reports (id),
  photo_id uuid NOT NULL REFERENCES public.photos (id),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_report_photos_active
  ON public.daily_report_photos (report_id, photo_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  title text NOT NULL,
  description text,
  assignee_membership_id uuid REFERENCES public.memberships (id),
  due_on date,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'todo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT project_tasks_priority_check CHECK (priority IN ('low', 'normal', 'high')),
  CONSTRAINT project_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'done'))
);

CREATE INDEX IF NOT EXISTS project_tasks_org_project
  ON public.project_tasks (organization_id, project_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_tasks_due
  ON public.project_tasks (organization_id, due_on)
  WHERE deleted_at IS NULL AND status <> 'done';

DROP TRIGGER IF EXISTS project_tasks_set_updated_at ON public.project_tasks;
CREATE TRIGGER project_tasks_set_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  project_id uuid REFERENCES public.projects (id),
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_inbox
  ON public.notifications (organization_id, profile_id, created_at DESC)
  WHERE deleted_at IS NULL AND read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_report_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_report_photos_select ON public.daily_report_photos;
CREATE POLICY daily_report_photos_select ON public.daily_report_photos
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = report_id
        AND r.deleted_at IS NULL
        AND public.auth_can_access_project(r.organization_id, r.project_id)
    )
  );

DROP POLICY IF EXISTS daily_report_photos_write ON public.daily_report_photos;
CREATE POLICY daily_report_photos_write ON public.daily_report_photos
  FOR ALL TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'capture.confirm')
    AND EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = report_id
        AND public.auth_can_access_project(r.organization_id, r.project_id)
    )
  )
  WITH CHECK (
    public.auth_has_permission(organization_id, 'capture.confirm')
    AND public.auth_is_org_member(organization_id)
  );

DROP POLICY IF EXISTS project_tasks_select ON public.project_tasks;
CREATE POLICY project_tasks_select ON public.project_tasks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_can_access_project(organization_id, project_id)
  );

DROP POLICY IF EXISTS project_tasks_insert ON public.project_tasks;
CREATE POLICY project_tasks_insert ON public.project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_access_project(organization_id, project_id)
    AND (
      public.auth_has_permission(organization_id, 'project.update')
      OR public.auth_has_permission(organization_id, 'capture.create')
    )
  );

DROP POLICY IF EXISTS project_tasks_update ON public.project_tasks;
CREATE POLICY project_tasks_update ON public.project_tasks
  FOR UPDATE TO authenticated
  USING (
    public.auth_can_access_project(organization_id, project_id)
    AND (
      public.auth_has_permission(organization_id, 'project.update')
      OR public.auth_has_permission(organization_id, 'capture.create')
    )
  );

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND profile_id = auth.uid()
    AND public.auth_is_org_member(organization_id)
  );

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND public.auth_is_org_member(organization_id))
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_org_member(organization_id)
    AND (
      profile_id = auth.uid()
      OR public.auth_has_permission(organization_id, 'project.update')
    )
  );

DROP POLICY IF EXISTS photos_update ON public.photos;
CREATE POLICY photos_update ON public.photos
  FOR UPDATE TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'photo.create')
    AND public.auth_is_org_member(organization_id)
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  )
  WITH CHECK (
    public.auth_is_org_member(organization_id)
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  );

DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (
      (
        project_id IS NOT NULL
        AND public.auth_can_access_project(organization_id, project_id)
      )
      OR (
        project_id IS NULL
        AND public.auth_has_permission(organization_id, 'knowledge.read')
      )
    )
  );

DROP POLICY IF EXISTS documents_write ON public.documents;
CREATE POLICY documents_write ON public.documents
  FOR ALL TO authenticated
  USING (
    public.auth_is_org_member(organization_id)
    AND (
      public.auth_has_permission(organization_id, 'knowledge.write')
      OR public.auth_has_permission(organization_id, 'import.manage')
      OR public.auth_has_permission(organization_id, 'project.update')
    )
  )
  WITH CHECK (
    public.auth_is_org_member(organization_id)
    AND (
      public.auth_has_permission(organization_id, 'knowledge.write')
      OR public.auth_has_permission(organization_id, 'import.manage')
      OR public.auth_has_permission(organization_id, 'project.update')
    )
  );
