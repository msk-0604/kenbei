-- 運営（KENBEI を売る側）が全社の利用状況を見るための集計。
-- サービスロール（サーバー）だけが呼べる。画面側は PLATFORM_ADMIN_EMAILS で更に絞る。
-- 見本データ（projects.source = 'sample'、作業員名が【見本】で始まる）は人数・現場数に数えない。

CREATE INDEX IF NOT EXISTS schedules_org_created ON public.schedules (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS daily_reports_org_created ON public.daily_reports (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS photos_org_created ON public.photos (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.platform_org_overview()
RETURNS TABLE (
  organization_id uuid,
  name text,
  created_at timestamptz,
  plan_code text,
  billing_status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  owner_email text,
  member_count int,
  worker_count int,
  site_count int,
  schedules_7d int,
  schedules_30d int,
  reports_30d int,
  photos_30d int,
  last_activity_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    o.id,
    o.name,
    o.created_at,
    ob.plan_code,
    ob.status,
    ob.trial_ends_at,
    ob.current_period_end,
    coalesce(ob.cancel_at_period_end, false),
    (
      SELECT u.email::text
      FROM public.memberships m
      JOIN public.roles r ON r.id = m.role_id
      JOIN auth.users u ON u.id = m.profile_id
      WHERE m.organization_id = o.id AND m.deleted_at IS NULL AND r.code = 'owner'
      ORDER BY m.created_at
      LIMIT 1
    ),
    (
      SELECT count(*)::int FROM public.memberships m
      WHERE m.organization_id = o.id AND m.status = 'active' AND m.deleted_at IS NULL
    ),
    (
      SELECT count(*)::int FROM public.workers w
      WHERE w.organization_id = o.id AND w.status = 'active' AND w.name NOT LIKE '【見本】%'
    ),
    (
      SELECT count(*)::int FROM public.projects p
      WHERE p.organization_id = o.id AND p.deleted_at IS NULL AND p.source <> 'sample'
    ),
    (
      SELECT count(*)::int FROM public.schedules s
      WHERE s.organization_id = o.id AND s.created_at > now() - interval '7 days'
    ),
    (
      SELECT count(*)::int FROM public.schedules s
      WHERE s.organization_id = o.id AND s.created_at > now() - interval '30 days'
    ),
    (
      SELECT count(*)::int FROM public.daily_reports d
      WHERE d.organization_id = o.id AND d.deleted_at IS NULL AND d.created_at > now() - interval '30 days'
    ),
    (
      SELECT count(*)::int FROM public.photos ph
      WHERE ph.organization_id = o.id AND ph.deleted_at IS NULL AND ph.created_at > now() - interval '30 days'
    ),
    GREATEST(
      (SELECT max(s.updated_at) FROM public.schedules s WHERE s.organization_id = o.id),
      (SELECT max(p.updated_at) FROM public.projects p WHERE p.organization_id = o.id),
      (SELECT max(d.created_at) FROM public.daily_reports d WHERE d.organization_id = o.id),
      (SELECT max(ph.created_at) FROM public.photos ph WHERE ph.organization_id = o.id)
    ),
    (
      SELECT max(u.last_sign_in_at)
      FROM public.memberships m
      JOIN auth.users u ON u.id = m.profile_id
      WHERE m.organization_id = o.id AND m.deleted_at IS NULL
    )
  FROM public.organizations o
  LEFT JOIN public.organization_billing ob ON ob.organization_id = o.id
  WHERE o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.platform_org_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_org_overview() TO service_role;
