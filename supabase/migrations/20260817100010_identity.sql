-- KenSapo migration 2/6: identity, org tree, RBAC.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone text,
  avatar_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended'))
);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id),
  manager_scope text NOT NULL DEFAULT 'all',
  office_can_read_finance boolean NOT NULL DEFAULT true,
  capture_auto_accept_threshold numeric NOT NULL DEFAULT 0.90,
  ai_provider text NOT NULL DEFAULT 'null',
  capture_retention_days int,
  ai_training_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_settings_manager_scope_check CHECK (manager_scope IN ('all', 'branch')),
  CONSTRAINT organization_settings_threshold_check CHECK (
    capture_auto_accept_threshold >= 0 AND capture_auto_accept_threshold <= 1
  )
);

CREATE TRIGGER organization_settings_set_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_security_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id),
  sso_enabled boolean NOT NULL DEFAULT false,
  scim_enabled boolean NOT NULL DEFAULT false,
  ip_allowlist inet[],
  device_restriction_enabled boolean NOT NULL DEFAULT false,
  mfa_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organization_security_settings_set_updated_at
  BEFORE UPDATE ON public.organization_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional. Small companies leave these empty.
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX branches_org_idx ON public.branches (organization_id) WHERE deleted_at IS NULL;
CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX departments_org_idx ON public.departments (organization_id) WHERE deleted_at IS NULL;
CREATE TRIGGER departments_set_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  department_id uuid REFERENCES public.departments (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE INDEX teams_org_idx ON public.teams (organization_id) WHERE deleted_at IS NULL;
CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.partner_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER partner_companies_set_updated_at
  BEFORE UPDATE ON public.partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permissions (
  code text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id),
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX roles_system_code_active
  ON public.roles (code)
  WHERE organization_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX roles_org_code_active
  ON public.roles (organization_id, code)
  WHERE organization_id IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions (code),
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  role_id uuid NOT NULL REFERENCES public.roles (id),
  branch_id uuid REFERENCES public.branches (id),
  department_id uuid REFERENCES public.departments (id),
  team_id uuid REFERENCES public.teams (id),
  partner_company_id uuid REFERENCES public.partner_companies (id),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz,
  CONSTRAINT memberships_status_check CHECK (status IN ('active', 'invited', 'disabled'))
);

CREATE UNIQUE INDEX memberships_active_unique
  ON public.memberships (organization_id, profile_id)
  WHERE deleted_at IS NULL;

CREATE INDEX memberships_profile_idx
  ON public.memberships (profile_id, organization_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.membership_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  membership_id uuid NOT NULL REFERENCES public.memberships (id),
  project_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TABLE public.user_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  name text NOT NULL,
  license_no text,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE TRIGGER user_qualifications_set_updated_at
  BEFORE UPDATE ON public.user_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  email text NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles (id),
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES public.profiles (id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX organization_invitations_org_email
  ON public.organization_invitations (organization_id, email)
  WHERE deleted_at IS NULL AND accepted_at IS NULL;

CREATE TRIGGER organization_invitations_set_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      split_part(NEW.email, '@', 1),
      'ユーザー'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
