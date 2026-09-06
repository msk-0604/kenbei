-- KenSapo migration 4/6: capture audit trail, knowledge, signals, ingest, jobs.

CREATE TABLE public.site_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  membership_id uuid NOT NULL REFERENCES public.memberships (id),
  work_on date NOT NULL,
  planned_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX site_sessions_today
  ON public.site_sessions (organization_id, work_on, membership_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER site_sessions_set_updated_at
  BEFORE UPDATE ON public.site_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid REFERENCES public.projects (id),
  site_session_id uuid REFERENCES public.site_sessions (id),
  kind text NOT NULL,
  raw_input text,
  audio_storage_path text,
  transcript text,
  extraction_json jsonb,
  ai_provider text,
  ai_model text,
  processing_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT captures_kind_check CHECK (kind IN ('voice', 'photo', 'tap', 'import'))
);

CREATE INDEX captures_org_project ON public.captures (organization_id, project_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER captures_set_updated_at
  BEFORE UPDATE ON public.captures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cost_entries
  ADD CONSTRAINT cost_entries_source_capture_fk
  FOREIGN KEY (source_capture_id) REFERENCES public.captures (id);

ALTER TABLE public.process_progress
  ADD CONSTRAINT process_progress_source_capture_fk
  FOREIGN KEY (source_capture_id) REFERENCES public.captures (id);

ALTER TABLE public.labor_entries
  ADD CONSTRAINT labor_entries_source_capture_fk
  FOREIGN KEY (source_capture_id) REFERENCES public.captures (id);

ALTER TABLE public.material_usages
  ADD CONSTRAINT material_usages_source_capture_fk
  FOREIGN KEY (source_capture_id) REFERENCES public.captures (id);

CREATE TABLE public.capture_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  capture_id uuid NOT NULL REFERENCES public.captures (id),
  project_id uuid REFERENCES public.projects (id),
  field_key text NOT NULL,
  confidence numeric NOT NULL,
  proposed_value_json jsonb NOT NULL,
  corrected_value_json jsonb,
  confirmed_value_json jsonb,
  value_json jsonb GENERATED ALWAYS AS (
    COALESCE(confirmed_value_json, corrected_value_json, proposed_value_json)
  ) STORED,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL,
  confirmed_by uuid REFERENCES public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT capture_fields_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT capture_fields_status_check CHECK (
    status IN ('pending', 'auto_accepted', 'confirmed', 'corrected', 'rejected')
  )
);

CREATE INDEX capture_fields_pending
  ON public.capture_fields (organization_id, status)
  WHERE deleted_at IS NULL AND status = 'pending';

CREATE TRIGGER capture_fields_set_updated_at
  BEFORE UPDATE ON public.capture_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  work_on date NOT NULL,
  body text NOT NULL,
  generated_from_capture_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER daily_reports_set_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid REFERENCES public.projects (id),
  capture_id uuid REFERENCES public.captures (id),
  process_id uuid REFERENCES public.processes (id),
  site_id uuid REFERENCES public.project_sites (id),
  captured_by uuid REFERENCES public.profiles (id),
  taken_at timestamptz NOT NULL,
  location_text text,
  lat double precision,
  lng double precision,
  category_key text,
  classification_confidence numeric,
  classification_source text,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX photos_org_project_taken
  ON public.photos (organization_id, project_id, taken_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER photos_set_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid REFERENCES public.projects (id),
  title text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TABLE public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  document_id uuid NOT NULL REFERENCES public.documents (id),
  body text,
  structured_json jsonb,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER knowledge_entries_set_updated_at
  BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.knowledge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge_entries (id),
  target_type text NOT NULL,
  target_key text,
  project_id uuid REFERENCES public.projects (id),
  incident_id uuid REFERENCES public.incidents (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT knowledge_links_target_check CHECK (
    target_type IN ('project', 'work_type', 'building_type', 'process', 'incident')
  )
);

CREATE TABLE public.project_features (
  project_id uuid PRIMARY KEY REFERENCES public.projects (id),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  building_type_key text,
  work_type_keys text[] NOT NULL DEFAULT '{}',
  scale_band text,
  amount_band text,
  prefecture_code text,
  city text,
  building_age_band text,
  duration_days int,
  labor_days numeric,
  gross_profit_rate numeric,
  has_additional_work boolean,
  has_pipe_reroute boolean,
  work_summary_norm text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_features_org_lookup
  ON public.project_features (organization_id, building_type_key, prefecture_code);

CREATE TRIGGER project_features_set_updated_at
  BEFORE UPDATE ON public.project_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_similarities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  seed_project_id uuid NOT NULL REFERENCES public.projects (id),
  match_project_id uuid NOT NULL REFERENCES public.projects (id),
  score numeric NOT NULL,
  engine text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid REFERENCES public.projects (id),
  kind text NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL,
  detector text NOT NULL,
  confidence numeric,
  visibility text NOT NULL DEFAULT 'project',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT signals_kind_check CHECK (kind IN ('recommendation', 'caution', 'prediction')),
  CONSTRAINT signals_severity_check CHECK (severity IN ('low', 'medium', 'high')),
  CONSTRAINT signals_visibility_check CHECK (visibility IN ('project', 'management')),
  CONSTRAINT signals_status_check CHECK (
    status IN ('open', 'acknowledged', 'accepted', 'dismissed', 'resolved')
  )
);

CREATE INDEX signals_org_open
  ON public.signals (organization_id, status, severity, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER signals_set_updated_at
  BEFORE UPDATE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.signal_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  signal_id uuid NOT NULL REFERENCES public.signals (id),
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  CONSTRAINT signal_feedback_action_check CHECK (action IN ('acknowledged', 'accepted', 'dismissed'))
);

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  kind text NOT NULL,
  source text NOT NULL DEFAULT 'csv',
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER import_jobs_set_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.import_jobs (id),
  row_no int NOT NULL,
  payload_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  applied_table text,
  applied_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  kind text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  run_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_run_queue ON public.jobs (status, run_after)
  WHERE status = 'queued';

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_daily_snapshots (
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  snapshot_on date NOT NULL,
  active_sites int NOT NULL DEFAULT 0,
  due_today int NOT NULL DEFAULT 0,
  delay_cautions int NOT NULL DEFAULT 0,
  revenue_forecast numeric,
  gross_profit_forecast numeric,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (organization_id, snapshot_on)
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  actor_profile_id uuid REFERENCES public.profiles (id),
  action text NOT NULL,
  target_table text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);
