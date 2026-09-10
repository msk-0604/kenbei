-- P1: partial unique Stripe subscription ids, pending invite uniqueness,
-- seat locking, membership disable guards. Additive / backward compatible.
-- Does not change RLS policies or widen service_role.

-- ---------------------------------------------------------------------------
-- Preflight (also in supabase/checks/p1_preflight_duplicates.sql):
-- Duplicate stripe_subscription_id or pending (org, email) will fail CREATE UNIQUE INDEX.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS organization_billing_stripe_subscription_id_uidx
  ON public.organization_billing (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL
    AND btrim(stripe_subscription_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_uidx
  ON public.organization_invitations (organization_id, lower(email))
  WHERE deleted_at IS NULL
    AND accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.lock_organization_billing_row(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_billing (organization_id, plan_code, status)
  VALUES (p_org, 'free', 'active')
  ON CONFLICT (organization_id) DO NOTHING;

  PERFORM 1
  FROM public.organization_billing
  WHERE organization_id = p_org
  FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_organization_billing_row(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.organization_seat_limit(p_org uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bp.max_members
  FROM public.organization_billing ob
  JOIN public.billing_plans bp ON bp.code = ob.plan_code
  WHERE ob.organization_id = p_org;
$$;

REVOKE ALL ON FUNCTION public.organization_seat_limit(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_pending_invite_seat(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_active int;
  v_pending int;
BEGIN
  PERFORM public.lock_organization_billing_row(p_org);
  v_limit := public.organization_seat_limit(p_org);

  SELECT count(*)::int INTO v_active
  FROM public.memberships
  WHERE organization_id = p_org
    AND status = 'active'
    AND deleted_at IS NULL;

  SELECT count(*)::int INTO v_pending
  FROM public.organization_invitations
  WHERE organization_id = p_org
    AND accepted_at IS NULL
    AND deleted_at IS NULL;

  IF v_limit IS NOT NULL AND (v_active + v_pending + 1) > v_limit THEN
    RAISE EXCEPTION 'KENBEI_SEAT_LIMIT' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_pending_invite_seat(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_reactivate_membership_seat(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_active int;
  v_pending int;
BEGIN
  PERFORM public.lock_organization_billing_row(p_org);
  v_limit := public.organization_seat_limit(p_org);

  SELECT count(*)::int INTO v_active
  FROM public.memberships
  WHERE organization_id = p_org
    AND status = 'active'
    AND deleted_at IS NULL;

  SELECT count(*)::int INTO v_pending
  FROM public.organization_invitations
  WHERE organization_id = p_org
    AND accepted_at IS NULL
    AND deleted_at IS NULL;

  IF v_limit IS NOT NULL AND (v_active + v_pending) >= v_limit THEN
    RAISE EXCEPTION 'KENBEI_SEAT_LIMIT' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_reactivate_membership_seat(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_active_membership_seat(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_active int;
BEGIN
  PERFORM public.lock_organization_billing_row(p_org);
  v_limit := public.organization_seat_limit(p_org);

  SELECT count(*)::int INTO v_active
  FROM public.memberships
  WHERE organization_id = p_org
    AND status = 'active'
    AND deleted_at IS NULL;

  IF v_limit IS NOT NULL AND v_active >= v_limit THEN
    RAISE EXCEPTION 'KENBEI_SEAT_LIMIT' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_active_membership_seat(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_organization_invite_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.accepted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.assert_pending_invite_seat(NEW.organization_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_invitations_protect_seats ON public.organization_invitations;
CREATE TRIGGER organization_invitations_protect_seats
  BEFORE INSERT ON public.organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_organization_invite_seats();

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
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'disabled' THEN
    IF NEW.profile_id = auth.uid() THEN
      RAISE EXCEPTION 'KENBEI_SELF_DISABLE' USING ERRCODE = 'P0001';
    END IF;
    v_role_id := COALESCE(OLD.role_id, NEW.role_id);
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

DROP TRIGGER IF EXISTS memberships_protect_status ON public.memberships;
CREATE TRIGGER memberships_protect_status
  BEFORE INSERT OR UPDATE OF status ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_membership_status();

CREATE OR REPLACE FUNCTION public.set_membership_status(p_membership_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.memberships%ROWTYPE;
BEGIN
  IF p_status NOT IN ('active', 'disabled') THEN
    RAISE EXCEPTION 'invalid membership status';
  END IF;

  SELECT * INTO v_row
  FROM public.memberships
  WHERE id = p_membership_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found';
  END IF;

  IF NOT public.auth_has_permission(v_row.organization_id, 'member.manage') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF v_row.status = p_status THEN
    RETURN;
  END IF;

  UPDATE public.memberships
  SET
    status = p_status,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_membership_id;

  PERFORM public.write_audit_log(
    v_row.organization_id,
    CASE WHEN p_status = 'disabled' THEN 'membership.disable' ELSE 'membership.enable' END,
    'memberships',
    p_membership_id,
    jsonb_build_object('from', v_row.status, 'to', p_status, 'profile_id', v_row.profile_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_membership_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_membership_status(uuid, text) TO authenticated;

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.organization_invitations
  WHERE token = p_token
    AND deleted_at IS NULL
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found or expired';
  END IF;

  IF lower(v_invite.email) <> v_email THEN
    RAISE EXCEPTION 'invite email mismatch';
  END IF;

  UPDATE public.organization_invitations
  SET accepted_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  SELECT id INTO v_membership_id
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
    SET role_id = v_invite.role_id,
        status = 'active',
        updated_by = v_uid,
        updated_at = now()
    WHERE id = v_membership_id;
  END IF;

  RETURN v_invite.organization_id;
END;
$$;

