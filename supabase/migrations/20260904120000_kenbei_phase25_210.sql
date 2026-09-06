-- KENBEI Phase 2-5 .. 2-10 additive schema. RLS stays on.

-- Chat: retry idempotency, edit timestamp, attachment metadata (soft-delete keeps body for audit/export)
ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachment_file_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text;

CREATE UNIQUE INDEX IF NOT EXISTS project_messages_client_id
  ON public.project_messages (organization_id, sender_profile_id, client_id)
  WHERE client_id IS NOT NULL;

-- Export: JSON+CSV inside ZIP is the downloadable artifact
ALTER TABLE public.export_jobs
  DROP CONSTRAINT IF EXISTS export_jobs_format_check;
ALTER TABLE public.export_jobs
  ADD CONSTRAINT export_jobs_format_check
  CHECK (format IN ('json', 'csv', 'zip'));

-- Stripe webhook idempotency
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid REFERENCES public.organizations (id),
  payload_digest text
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: service role / webhook only.

-- Serverless rate limit
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  hit_count int NOT NULL DEFAULT 0,
  window_ends_at timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_count int;
  v_ends timestamptz;
BEGIN
  INSERT INTO public.rate_limit_buckets (bucket_key, hit_count, window_ends_at)
  VALUES (p_key, 1, v_now + make_interval(secs => GREATEST(p_window_seconds, 1)))
  ON CONFLICT (bucket_key) DO UPDATE
    SET hit_count = CASE
      WHEN public.rate_limit_buckets.window_ends_at < v_now THEN 1
      ELSE public.rate_limit_buckets.hit_count + 1
    END,
    window_ends_at = CASE
      WHEN public.rate_limit_buckets.window_ends_at < v_now
        THEN v_now + make_interval(secs => GREATEST(p_window_seconds, 1))
      ELSE public.rate_limit_buckets.window_ends_at
    END
  RETURNING hit_count, window_ends_at INTO v_count, v_ends;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, int, int) TO authenticated;

-- Ops signals (decision engine persistence; resolved_at for 解消)
CREATE TABLE IF NOT EXISTS public.ops_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  project_id uuid REFERENCES public.projects (id),
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'rules',
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT ops_signals_severity_check CHECK (severity IN ('low', 'medium', 'high')),
  CONSTRAINT ops_signals_type_check CHECK (signal_type IN (
    'overdue_task', 'delayed_process', 'pending_confirmation',
    'unconfirmed_report', 'failed_upload', 'overdue_approval'
  ))
);

CREATE INDEX IF NOT EXISTS ops_signals_open
  ON public.ops_signals (organization_id, created_at DESC)
  WHERE resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.ops_signals TO authenticated;
ALTER TABLE public.ops_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_signals_select ON public.ops_signals;
CREATE POLICY ops_signals_select ON public.ops_signals
  FOR SELECT TO authenticated
  USING (
    public.auth_is_org_member(organization_id)
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  );

DROP POLICY IF EXISTS ops_signals_write ON public.ops_signals;
CREATE POLICY ops_signals_write ON public.ops_signals
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_is_org_member(organization_id));

-- Align 2-4 push_tokens columns if Phase 2 table already existed
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Realtime for project chat
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Process dependency (minimal)
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS depends_on_process_id uuid REFERENCES public.processes (id);
