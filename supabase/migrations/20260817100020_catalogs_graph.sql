-- KenSapo migration 3/6: catalogs and Construction Graph hub.

CREATE TABLE public.system_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (kind, key)
);

CREATE TABLE public.organization_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  kind text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  custom_code text,
  aliases text[] NOT NULL DEFAULT '{}',
  is_enabled boolean NOT NULL DEFAULT true,
  overrides_system_key text,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX organization_catalogs_active_key
  ON public.organization_catalogs (organization_id, kind, key)
  WHERE deleted_at IS NULL;

CREATE TRIGGER organization_catalogs_set_updated_at
  BEFORE UPDATE ON public.organization_catalogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  name_kana text,
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX customers_org_idx ON public.customers (organization_id) WHERE deleted_at IS NULL;
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER customer_contacts_set_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  code text NOT NULL,
  name text NOT NULL,
  spec text,
  unit text NOT NULL DEFAULT '本',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX materials_code_active
  ON public.materials (organization_id, code)
  WHERE deleted_at IS NULL;

CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  customer_id uuid REFERENCES public.customers (id),
  branch_id uuid REFERENCES public.branches (id),
  department_id uuid REFERENCES public.departments (id),
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
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT projects_status_check CHECK (
    status IN ('draft', 'active', 'on_hold', 'completed', 'cancelled')
  )
);

CREATE INDEX projects_org_status ON public.projects (organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX projects_org_planned_end ON public.projects (organization_id, planned_end_on)
  WHERE deleted_at IS NULL;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.membership_project_access
  ADD CONSTRAINT membership_project_access_project_fk
  FOREIGN KEY (project_id) REFERENCES public.projects (id);

CREATE UNIQUE INDEX membership_project_access_active
  ON public.membership_project_access (membership_id, project_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.project_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  name text,
  address text,
  lat double precision,
  lng double precision,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX project_sites_project_idx ON public.project_sites (organization_id, project_id)
  WHERE deleted_at IS NULL;
CREATE TRIGGER project_sites_set_updated_at
  BEFORE UPDATE ON public.project_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  work_type_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  membership_id uuid NOT NULL REFERENCES public.memberships (id),
  role_in_project text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX project_members_active
  ON public.project_members (project_id, membership_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER project_members_set_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_financials (
  project_id uuid PRIMARY KEY REFERENCES public.projects (id),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
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
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE TRIGGER project_financials_set_updated_at
  BEFORE UPDATE ON public.project_financials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER estimate_items_set_updated_at
  BEFORE UPDATE ON public.estimate_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  category text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER budget_items_set_updated_at
  BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  category text NOT NULL,
  amount numeric NOT NULL,
  occurred_on date NOT NULL,
  note text,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT cost_entries_category_check CHECK (
    category IN ('material', 'subcontract', 'labor', 'other')
  )
);

CREATE INDEX cost_entries_project_idx ON public.cost_entries (organization_id, project_id, occurred_on)
  WHERE deleted_at IS NULL;
CREATE TRIGGER cost_entries_set_updated_at
  BEFORE UPDATE ON public.cost_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  parent_id uuid REFERENCES public.processes (id),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  planned_start_on date,
  planned_end_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX processes_project_idx ON public.processes (organization_id, project_id, sort_order)
  WHERE deleted_at IS NULL;
CREATE TRIGGER processes_set_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.process_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  process_id uuid NOT NULL REFERENCES public.processes (id),
  percent int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started',
  recorded_on date NOT NULL,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT process_progress_percent_check CHECK (percent >= 0 AND percent <= 100)
);

CREATE TABLE public.labor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  kind text NOT NULL,
  work_on date,
  worker_count numeric,
  labor_days numeric NOT NULL,
  membership_ids uuid[],
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT labor_entries_kind_check CHECK (kind IN ('planned', 'actual'))
);

CREATE INDEX labor_entries_project_idx ON public.labor_entries (organization_id, project_id, kind)
  WHERE deleted_at IS NULL;
CREATE TRIGGER labor_entries_set_updated_at
  BEFORE UPDATE ON public.labor_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.material_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  material_id uuid REFERENCES public.materials (id),
  material_code_text text,
  quantity numeric NOT NULL,
  unit text,
  used_on date,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER material_usages_set_updated_at
  BEFORE UPDATE ON public.material_usages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  kind text NOT NULL,
  title text NOT NULL,
  amount numeric,
  occurred_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT change_orders_kind_check CHECK (kind IN ('additional', 'change'))
);

CREATE TRIGGER change_orders_set_updated_at
  BEFORE UPDATE ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  kind text NOT NULL,
  title text NOT NULL,
  occurred_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT incidents_kind_check CHECK (kind IN ('rework', 'trouble', 'claim'))
);

CREATE TRIGGER incidents_set_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.incident_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  incident_id uuid NOT NULL REFERENCES public.incidents (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TABLE public.incident_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  incident_id uuid NOT NULL REFERENCES public.incidents (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TABLE public.project_outcomes (
  project_id uuid PRIMARY KEY REFERENCES public.projects (id),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  result_summary text,
  completed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE TRIGGER project_outcomes_set_updated_at
  BEFORE UPDATE ON public.project_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid NOT NULL REFERENCES public.projects (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);
