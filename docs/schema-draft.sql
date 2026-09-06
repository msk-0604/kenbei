-- KenSapo schema draft (design review)
-- Not a production migration. Implementation will split this into supabase/migrations.
-- Conventions: uuid PK, organization_id on tenant tables, soft delete, audit columns.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone text,
  avatar_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations (id),
  manager_scope text NOT NULL DEFAULT 'all', -- all | branch
  office_can_read_finance boolean NOT NULL DEFAULT true,
  capture_auto_accept_threshold numeric NOT NULL DEFAULT 0.90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Future: SSO / SCIM / IP / device / MFA. Unused means no extra restriction.
CREATE TABLE organization_security_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations (id),
  sso_enabled boolean NOT NULL DEFAULT false,
  scim_enabled boolean NOT NULL DEFAULT false,
  ip_allowlist inet[],
  device_restriction_enabled boolean NOT NULL DEFAULT false,
  mfa_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  branch_id uuid REFERENCES branches (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  department_id uuid REFERENCES departments (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE partner_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE permissions (
  code text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations (id), -- NULL = system role
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz,
  UNIQUE (organization_id, code)
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions (code),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  profile_id uuid NOT NULL REFERENCES profiles (id),
  role_id uuid NOT NULL REFERENCES roles (id),
  branch_id uuid REFERENCES branches (id),
  department_id uuid REFERENCES departments (id),
  team_id uuid REFERENCES teams (id),
  partner_company_id uuid REFERENCES partner_companies (id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX memberships_active_unique
  ON memberships (organization_id, profile_id)
  WHERE deleted_at IS NULL;

CREATE TABLE membership_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  membership_id uuid NOT NULL REFERENCES memberships (id),
  project_id uuid NOT NULL, -- FK added after projects
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE user_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  profile_id uuid NOT NULL REFERENCES profiles (id),
  name text NOT NULL,
  license_no text,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Catalogs
-- ---------------------------------------------------------------------------

CREATE TABLE system_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- work_type, building_type, photo_category, incident_kind, ...
  key text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (kind, key)
);

CREATE TABLE organization_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  kind text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  overrides_system_key text,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz,
  UNIQUE (organization_id, kind, key)
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL,
  name_kana text,
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  customer_id uuid NOT NULL REFERENCES customers (id),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  code text NOT NULL, -- HI25
  name text NOT NULL,
  spec text,
  unit text NOT NULL DEFAULT '本',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX materials_code_active
  ON materials (organization_id, code)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Construction Graph hub
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  customer_id uuid REFERENCES customers (id),
  branch_id uuid REFERENCES branches (id),
  department_id uuid REFERENCES departments (id),
  code text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  building_type_key text,
  work_summary text,
  scale_value numeric,
  scale_unit text,
  prefecture_code text,
  city text,
  area_label text,
  building_year int,
  planned_start_on date,
  planned_end_on date,
  actual_start_on date,
  actual_end_on date,
  source text NOT NULL DEFAULT 'manual',
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE INDEX projects_org_status ON projects (organization_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE membership_project_access
  ADD CONSTRAINT membership_project_access_project_fk
  FOREIGN KEY (project_id) REFERENCES projects (id);

CREATE TABLE project_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  name text,
  address text,
  lat double precision,
  lng double precision,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE project_work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  work_type_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  membership_id uuid NOT NULL REFERENCES memberships (id),
  role_in_project text NOT NULL, -- supervisor | worker | office | partner
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE project_financials (
  project_id uuid PRIMARY KEY REFERENCES projects (id),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  contract_amount numeric,
  estimate_amount numeric,
  budget_amount numeric,
  material_cost_actual numeric,
  subcontract_cost_actual numeric,
  labor_cost_actual numeric,
  other_cost_actual numeric,
  final_cost numeric,
  revenue numeric,
  gross_profit numeric,
  gross_profit_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id)
);

CREATE TABLE estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  category text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  category text NOT NULL, -- material | subcontract | labor | other
  amount numeric NOT NULL,
  occurred_on date NOT NULL,
  note text,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  parent_id uuid REFERENCES processes (id),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  planned_start_on date,
  planned_end_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE process_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  process_id uuid NOT NULL REFERENCES processes (id),
  percent int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started',
  recorded_on date NOT NULL,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE labor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  kind text NOT NULL, -- planned | actual
  work_on date,
  worker_count numeric,
  labor_days numeric NOT NULL,
  membership_ids uuid[],
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE material_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  material_id uuid REFERENCES materials (id),
  material_code_text text, -- unmatched speech like HI25
  quantity numeric NOT NULL,
  unit text,
  used_on date,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  kind text NOT NULL, -- additional | change
  title text NOT NULL,
  amount numeric,
  occurred_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  kind text NOT NULL, -- rework | trouble | claim
  title text NOT NULL,
  occurred_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE incident_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  incident_id uuid NOT NULL REFERENCES incidents (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE incident_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  incident_id uuid NOT NULL REFERENCES incidents (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE project_outcomes (
  project_id uuid PRIMARY KEY REFERENCES projects (id),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  result_summary text,
  completed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id)
);

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Capture / photos / documents
-- ---------------------------------------------------------------------------

CREATE TABLE site_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  membership_id uuid NOT NULL REFERENCES memberships (id),
  work_on date NOT NULL,
  planned_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE INDEX site_sessions_today
  ON site_sessions (organization_id, work_on, membership_id)
  WHERE deleted_at IS NULL;

CREATE TABLE captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid REFERENCES projects (id),
  site_session_id uuid REFERENCES site_sessions (id),
  kind text NOT NULL, -- voice | photo | tap | import
  transcript text,
  raw_ai_json jsonb,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE capture_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  capture_id uuid NOT NULL REFERENCES captures (id),
  project_id uuid REFERENCES projects (id),
  field_key text NOT NULL,
  value_json jsonb NOT NULL,
  confidence numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | auto_accepted | confirmed | corrected | rejected
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE INDEX capture_fields_pending
  ON capture_fields (organization_id, status)
  WHERE deleted_at IS NULL AND status = 'pending';

CREATE TABLE daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid NOT NULL REFERENCES projects (id),
  work_on date NOT NULL,
  body text NOT NULL,
  generated_from_capture_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid REFERENCES projects (id),
  capture_id uuid REFERENCES captures (id),
  process_id uuid REFERENCES processes (id),
  site_id uuid REFERENCES project_sites (id),
  captured_by uuid REFERENCES profiles (id),
  taken_at timestamptz NOT NULL,
  location_text text,
  lat double precision,
  lng double precision,
  category_key text,
  classification_confidence numeric,
  classification_source text, -- context | exif | model
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX photos_org_project_taken
  ON photos (organization_id, project_id, taken_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid REFERENCES projects (id),
  title text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  document_id uuid NOT NULL REFERENCES documents (id),
  body text,
  structured_json jsonb,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Knowledge / similar / signals
-- ---------------------------------------------------------------------------

CREATE TABLE knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  updated_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE knowledge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  knowledge_id uuid NOT NULL REFERENCES knowledge_entries (id),
  target_type text NOT NULL, -- project | work_type | building_type | process | incident
  target_key text,
  project_id uuid REFERENCES projects (id),
  incident_id uuid REFERENCES incidents (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE project_features (
  project_id uuid PRIMARY KEY REFERENCES projects (id),
  organization_id uuid NOT NULL REFERENCES organizations (id),
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
  embedding vector, -- Phase 2+. MVP may omit extension
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_similarities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  seed_project_id uuid NOT NULL REFERENCES projects (id),
  match_project_id uuid NOT NULL REFERENCES projects (id),
  score numeric NOT NULL,
  engine text NOT NULL, -- rule_v1 | embedding_v1
  evidence_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  project_id uuid REFERENCES projects (id),
  kind text NOT NULL, -- recommendation | caution | prediction
  code text NOT NULL,
  title text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}',
  severity text NOT NULL,
  detector text NOT NULL,
  confidence numeric,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX signals_org_open
  ON signals (organization_id, status, severity, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE signal_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  signal_id uuid NOT NULL REFERENCES signals (id),
  action text NOT NULL, -- acknowledged | accepted | dismissed
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id)
);

-- ---------------------------------------------------------------------------
-- Ingest / jobs / audit
-- ---------------------------------------------------------------------------

CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  kind text NOT NULL, -- csv_projects | csv_customers | csv_members | photos_bulk | pdf_bulk
  source text NOT NULL DEFAULT 'csv', -- csv | excel | andpad | kanna
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  stats_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles (id),
  deleted_at timestamptz
);

CREATE TABLE import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  job_id uuid NOT NULL REFERENCES import_jobs (id),
  row_no int NOT NULL,
  payload_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | mapped | applied | error
  error_message text,
  applied_table text,
  applied_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  kind text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  run_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_daily_snapshots (
  organization_id uuid NOT NULL REFERENCES organizations (id),
  snapshot_on date NOT NULL,
  active_sites int NOT NULL DEFAULT 0,
  due_today int NOT NULL DEFAULT 0,
  delay_cautions int NOT NULL DEFAULT 0,
  revenue_forecast numeric,
  gross_profit_forecast numeric,
  payload_json jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (organization_id, snapshot_on)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  actor_profile_id uuid REFERENCES profiles (id),
  action text NOT NULL,
  target_table text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_org_created
  ON audit_logs (organization_id, created_at DESC);
