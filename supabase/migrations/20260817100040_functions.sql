-- KenSapo migration 5/6: auth helpers, org bootstrap, audit writer.

CREATE OR REPLACE FUNCTION public.auth_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.organization_id
  FROM public.memberships m
  WHERE m.profile_id = auth.uid()
    AND m.status = 'active'
    AND m.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.auth_is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = p_org_id
      AND m.profile_id = auth.uid()
      AND m.status = 'active'
      AND m.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_has_permission(p_org_id uuid, p_permission_code text)
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
      AND m.profile_id = auth.uid()
      AND m.status = 'active'
      AND m.deleted_at IS NULL
      AND rp.permission_code = p_permission_code
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_can_access_project(p_org_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_has_permission(p_org_id, 'project.read_all')
    OR EXISTS (
      SELECT 1
      FROM public.membership_project_access a
      JOIN public.memberships m ON m.id = a.membership_id
      WHERE a.organization_id = p_org_id
        AND a.project_id = p_project_id
        AND a.deleted_at IS NULL
        AND m.profile_id = auth.uid()
        AND m.status = 'active'
        AND m.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      JOIN public.memberships m ON m.id = pm.membership_id
      WHERE pm.organization_id = p_org_id
        AND pm.project_id = p_project_id
        AND pm.deleted_at IS NULL
        AND m.profile_id = auth.uid()
        AND m.status = 'active'
        AND m.deleted_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_organization_id uuid,
  p_action text,
  p_target_table text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    organization_id,
    actor_profile_id,
    action,
    target_table,
    target_id,
    metadata
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    p_action,
    p_target_table,
    p_target_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_slug text;
  v_owner_role_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'organization name is required';
  END IF;

  SELECT r.id
  INTO v_owner_role_id
  FROM public.roles r
  WHERE r.code = 'owner'
    AND r.organization_id IS NULL
    AND r.deleted_at IS NULL;

  IF v_owner_role_id IS NULL THEN
    RAISE EXCEPTION 'system owner role is missing';
  END IF;

  v_slug := 'org-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  INSERT INTO public.organizations (name, slug, created_by, updated_by)
  VALUES (btrim(p_name), v_slug, auth.uid(), auth.uid())
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_settings (organization_id)
  VALUES (v_org_id);

  INSERT INTO public.organization_security_settings (organization_id)
  VALUES (v_org_id);

  INSERT INTO public.memberships (
    organization_id,
    profile_id,
    role_id,
    status,
    created_by,
    updated_by
  )
  VALUES (
    v_org_id,
    auth.uid(),
    v_owner_role_id,
    'active',
    auth.uid(),
    auth.uid()
  );

  PERFORM public.write_audit_log(
    v_org_id,
    'organization.create',
    'organizations',
    v_org_id,
    jsonb_build_object('name', btrim(p_name))
  );

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_organization_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_access_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;
