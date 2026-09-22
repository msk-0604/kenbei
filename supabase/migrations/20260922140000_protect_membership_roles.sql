-- P0: block role_id escalation, owner invites, and last-owner removal.
-- Additive. Does not weaken RLS or change billing/trial.

CREATE OR REPLACE FUNCTION public.invite_role_is_allowed(p_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = p_role_id
      AND r.organization_id IS NULL
      AND r.deleted_at IS NULL
      AND r.code IN ('worker', 'supervisor', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.active_owner_count(p_organization_id uuid, p_except_membership_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.memberships m
  JOIN public.roles r ON r.id = m.role_id
  WHERE m.organization_id = p_organization_id
    AND m.deleted_at IS NULL
    AND m.status = 'active'
    AND r.code = 'owner'
    AND (p_except_membership_id IS NULL OR m.id IS DISTINCT FROM p_except_membership_id);
$$;

CREATE OR REPLACE FUNCTION public.protect_organization_invite_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.invite_role_is_allowed(NEW.role_id) THEN
    RAISE EXCEPTION 'KENBEI_INVITE_ROLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_invitations_protect_role ON public.organization_invitations;
CREATE TRIGGER organization_invitations_protect_role
  BEFORE INSERT OR UPDATE OF role_id ON public.organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_organization_invite_role();

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

DROP TRIGGER IF EXISTS memberships_protect_role ON public.memberships;
CREATE TRIGGER memberships_protect_role
  BEFORE INSERT OR UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_membership_role();

CREATE OR REPLACE FUNCTION public.protect_membership_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_managers int;
  v_is_manager boolean;
  v_role_id uuid;
  v_role_code text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'disabled' THEN
    IF NEW.profile_id = auth.uid() THEN
      RAISE EXCEPTION 'KENBEI_SELF_DISABLE' USING ERRCODE = 'P0001';
    END IF;
    v_role_id := COALESCE(OLD.role_id, NEW.role_id);
    SELECT r.code INTO v_role_code
    FROM public.roles r
    WHERE r.id = v_role_id;
    IF v_role_code = 'owner' AND public.active_owner_count(NEW.organization_id, NEW.id) = 0 THEN
      RAISE EXCEPTION 'KENBEI_LAST_OWNER' USING ERRCODE = 'P0001';
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      WHERE rp.role_id = v_role_id
        AND rp.permission_code = 'org.manage'
    ) INTO v_is_manager;
    IF v_is_manager THEN
      SELECT count(*)::int INTO v_other_managers
      FROM public.memberships m
      WHERE m.organization_id = NEW.organization_id
        AND m.deleted_at IS NULL
        AND m.status = 'active'
        AND m.id IS DISTINCT FROM NEW.id
        AND EXISTS (
          SELECT 1
          FROM public.role_permissions rp
          WHERE rp.role_id = m.role_id
            AND rp.permission_code = 'org.manage'
        );
      IF v_other_managers = 0 THEN
        RAISE EXCEPTION 'KENBEI_LAST_MANAGER' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' THEN
    IF TG_OP = 'UPDATE' THEN
      PERFORM public.assert_reactivate_membership_seat(NEW.organization_id);
    ELSE
      PERFORM public.assert_active_membership_seat(NEW.organization_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invitations%ROWTYPE;
  v_membership_id uuid;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_other_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.organization_invitations
  WHERE token = p_token
    AND deleted_at IS NULL
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found or expired';
  END IF;

  IF NOT public.invite_role_is_allowed(v_invite.role_id) THEN
    RAISE EXCEPTION 'KENBEI_INVITE_ROLE' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.email IS NOT NULL AND lower(v_invite.email) <> v_email THEN
    RAISE EXCEPTION 'invite email mismatch';
  END IF;

  SELECT m.organization_id
  INTO v_other_org
  FROM public.memberships m
  WHERE m.profile_id = v_uid
    AND m.status = 'active'
    AND m.deleted_at IS NULL
    AND m.organization_id IS DISTINCT FROM v_invite.organization_id
  LIMIT 1;

  IF v_other_org IS NOT NULL THEN
    RAISE EXCEPTION 'KENBEI_ALREADY_IN_ORG' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organization_invitations
  SET accepted_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  SELECT id
  INTO v_membership_id
  FROM public.memberships
  WHERE organization_id = v_invite.organization_id
    AND profile_id = v_uid
    AND deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_membership_id IS NULL THEN
    INSERT INTO public.memberships (
      organization_id,
      profile_id,
      role_id,
      status,
      created_by,
      updated_by
    )
    VALUES (
      v_invite.organization_id,
      v_uid,
      v_invite.role_id,
      'active',
      v_uid,
      v_uid
    )
    RETURNING id INTO v_membership_id;
  ELSE
    UPDATE public.memberships
    SET status = 'active',
        updated_by = v_uid,
        updated_at = now()
    WHERE id = v_membership_id;
  END IF;

  RETURN v_invite.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_role_is_allowed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.active_owner_count(uuid, uuid) FROM PUBLIC;
