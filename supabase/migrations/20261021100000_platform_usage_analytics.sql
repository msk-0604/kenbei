-- 運営（KENBEI を売る側）の分析画面（/ops/analytics）で使う集計。PDCA を回すため、
-- 会社ごとの立ち上がり（どこまで使い始めたか）と、日ごとの利用の件数を返す。
-- サービスロール（サーバー）だけが呼べる。画面側は PLATFORM_ADMIN_EMAILS で更に絞る。
-- 見本データ（projects.source = 'sample'）の予定は数えない。

CREATE INDEX IF NOT EXISTS schedules_actual_start ON public.schedules (actual_start_time)
  WHERE actual_start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_tasks_org_created ON public.project_tasks (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_messages_org_created ON public.project_messages (organization_id, created_at DESC);

-- 会社ごとの「ここまでやったことがあるか」（いつでも1回でも）
CREATE OR REPLACE FUNCTION public.platform_org_activation()
RETURNS TABLE (
  organization_id uuid,
  has_schedule boolean,
  has_work_start boolean,
  has_confirmed_report boolean,
  ever_paid boolean,
  first_schedule_at timestamptz,
  first_report_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    o.id,
    EXISTS (
      SELECT 1 FROM public.schedules s JOIN public.projects p ON p.id = s.project_id
      WHERE s.organization_id = o.id AND p.source IS DISTINCT FROM 'sample'
    ),
    EXISTS (
      SELECT 1 FROM public.schedules s JOIN public.projects p ON p.id = s.project_id
      WHERE s.organization_id = o.id AND s.actual_start_time IS NOT NULL AND p.source IS DISTINCT FROM 'sample'
    ),
    EXISTS (
      SELECT 1 FROM public.daily_reports d
      WHERE d.organization_id = o.id AND d.deleted_at IS NULL AND d.status = 'confirmed'
    ),
    EXISTS (
      SELECT 1 FROM public.sales_funnel_events f WHERE f.organization_id = o.id AND f.event_kind = 'paid'
    ),
    (
      SELECT min(s.created_at) FROM public.schedules s JOIN public.projects p ON p.id = s.project_id
      WHERE s.organization_id = o.id AND p.source IS DISTINCT FROM 'sample'
    ),
    (
      SELECT min(d.created_at) FROM public.daily_reports d
      WHERE d.organization_id = o.id AND d.deleted_at IS NULL AND d.status = 'confirmed'
    )
  FROM public.organizations o
  WHERE o.deleted_at IS NULL;
$$;

-- p_since 以降の、会社 × 日（日本時間）× 種類 の件数。visit はトップページなどへの訪問（会社はまだない）。
CREATE OR REPLACE FUNCTION public.platform_activity_daily(p_since timestamptz)
RETURNS TABLE (
  organization_id uuid,
  day date,
  kind text,
  n int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.organization_id, (s.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'schedule', count(*)::int
  FROM public.schedules s JOIN public.projects p ON p.id = s.project_id
  WHERE s.created_at >= p_since AND p.source IS DISTINCT FROM 'sample'
  GROUP BY 1, 2
  UNION ALL
  SELECT s.organization_id, (s.actual_start_time AT TIME ZONE 'Asia/Tokyo')::date, 'work_start', count(*)::int
  FROM public.schedules s JOIN public.projects p ON p.id = s.project_id
  WHERE s.actual_start_time >= p_since AND p.source IS DISTINCT FROM 'sample'
  GROUP BY 1, 2
  UNION ALL
  SELECT ph.organization_id, (ph.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'photo', count(*)::int
  FROM public.photos ph
  WHERE ph.created_at >= p_since AND ph.deleted_at IS NULL
  GROUP BY 1, 2
  UNION ALL
  SELECT d.organization_id, (d.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'report', count(*)::int
  FROM public.daily_reports d
  WHERE d.created_at >= p_since AND d.deleted_at IS NULL
  GROUP BY 1, 2
  UNION ALL
  SELECT t.organization_id, (t.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'task', count(*)::int
  FROM public.project_tasks t
  WHERE t.created_at >= p_since AND t.deleted_at IS NULL
  GROUP BY 1, 2
  UNION ALL
  SELECT m.organization_id, (m.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'chat', count(*)::int
  FROM public.project_messages m
  WHERE m.created_at >= p_since AND m.deleted_at IS NULL
  GROUP BY 1, 2
  UNION ALL
  SELECT NULL::uuid, (f.created_at AT TIME ZONE 'Asia/Tokyo')::date, 'visit', count(DISTINCT f.visitor_id)::int
  FROM public.sales_funnel_events f
  WHERE f.created_at >= p_since AND f.event_kind = 'visit'
  GROUP BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.platform_org_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_org_activation() TO service_role;
REVOKE ALL ON FUNCTION public.platform_activity_daily(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_activity_daily(timestamptz) TO service_role;
