-- KENBEI: accept organization invitations (table already exists).

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

  SELECT id INTO v_membership_id
  FROM public.memberships
  WHERE organization_id = v_invite.organization_id
    AND profile_id = v_uid
    AND deleted_at IS NULL
  LIMIT 1;

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

  UPDATE public.organization_invitations
  SET accepted_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_organization_invite(text) TO authenticated;

DROP POLICY IF EXISTS organization_invitations_select_invitee ON public.organization_invitations;
CREATE POLICY organization_invitations_select_invitee ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND accepted_at IS NULL
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
