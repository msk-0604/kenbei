-- Additive preview field so join can lock the invited email. Does not change P0, RLS, or accept.

DROP FUNCTION IF EXISTS public.preview_organization_invite(text);

CREATE FUNCTION public.preview_organization_invite(p_token text)
RETURNS TABLE (
  company_name text,
  role_label text,
  invite_state text,
  email_state text,
  invited_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invitations%ROWTYPE;
  v_code text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    company_name := NULL;
    role_label := NULL;
    invite_state := 'not_found';
    email_state := 'anon';
    invited_email := NULL;
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
    email_state := 'anon';
    invited_email := NULL;
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

  invited_email := CASE WHEN v_invite.email IS NULL THEN NULL ELSE lower(v_invite.email) END;

  IF v_invite.accepted_at IS NOT NULL THEN
    invite_state := 'used';
  ELSIF v_invite.expires_at <= now() THEN
    invite_state := 'expired';
  ELSE
    invite_state := 'ok';
  END IF;

  IF auth.uid() IS NULL THEN
    email_state := 'anon';
  ELSIF v_invite.email IS NULL THEN
    email_state := 'open';
  ELSIF lower(v_invite.email) = v_email THEN
    email_state := 'match';
  ELSE
    email_state := 'mismatch';
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_organization_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_organization_invite(text) TO anon, authenticated;
