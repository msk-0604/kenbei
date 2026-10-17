-- 現場の削除（論理削除）。
-- projects の SELECT ポリシーは deleted_at IS NULL の行しか見せないため、利用者の権限で
-- deleted_at を入れる UPDATE は「新しい行が RLS に違反」で失敗していた。
-- 管理者（project.create）かを確かめたうえで、予定・作業工程を消して現場に deleted_at を入れる。
-- 写真・日報の記録は残す。

CREATE OR REPLACE FUNCTION public.soft_delete_sites(p_org_id uuid, p_site_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_count int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_is_site_admin(p_org_id) THEN
    RAISE EXCEPTION 'only site admins can delete sites' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(p.id), '{}')
  INTO v_ids
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND p.id = ANY (coalesce(p_site_ids, '{}'))
    AND p.deleted_at IS NULL;

  IF cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.schedules WHERE organization_id = p_org_id AND project_id = ANY (v_ids);
  DELETE FROM public.project_progress_items WHERE organization_id = p_org_id AND project_id = ANY (v_ids);
  UPDATE public.projects
  SET deleted_at = now(), updated_by = auth.uid()
  WHERE organization_id = p_org_id AND id = ANY (v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_sites(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_sites(uuid, uuid[]) TO authenticated;
