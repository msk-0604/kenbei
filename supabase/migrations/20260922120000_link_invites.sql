-- Link invites: email optional on new rows. Existing email invites stay unchanged.

ALTER TABLE public.organization_invitations
  ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.preview_organization_invite(p_token text)
RETURNS TABLE (
  company_name text,
  role_label text,
  invite_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invitations%ROWTYPE;
  v_code text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    company_name := NULL;
    role_label := NULL;
    invite_state := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_invite
  FROM public.organization_invitations
  WHERE token = p_token
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    company_name := NULL;
    role_label := NULL;
    invite_state := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT o.name
  INTO company_name
  FROM public.organizations o
  WHERE o.id = v_invite.organization_id;

  SELECT r.code
  INTO v_code
  FROM public.roles r
  WHERE r.id = v_invite.role_id;

  role_label := CASE v_code
    WHEN 'supervisor' THEN '現場管理者'
    WHEN 'manager' THEN '管理者'
    WHEN 'worker' THEN '一般メンバー'
    WHEN 'office' THEN '事務'
    WHEN 'executive' THEN '経営'
    WHEN 'owner' THEN '代表'
    WHEN 'partner' THEN '協力会社'
    WHEN 'guest' THEN 'ゲスト'
    ELSE 'メンバー'
  END;

  IF v_invite.accepted_at IS NOT NULL THEN
    invite_state := 'used';
  ELSIF v_invite.expires_at <= now() THEN
    invite_state := 'expired';
  ELSE
    invite_state := 'ok';
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_organization_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_organization_invite(text) TO anon, authenticated;

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
    SET role_id = v_invite.role_id,
        status = 'active',
        updated_by = v_uid,
        updated_at = now()
    WHERE id = v_membership_id;
  END IF;

  RETURN v_invite.organization_id;
END;
$$;
