-- KENBEI RC1: missing constraints / RLS for a clean apply from empty DB.
-- Does not disable RLS. Additive only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_organization_id uuid REFERENCES public.organizations (id);

CREATE INDEX IF NOT EXISTS export_jobs_org_created
  ON public.export_jobs (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

UPDATE public.push_tokens
SET device_id = COALESCE(NULLIF(device_id, ''), id::text)
WHERE device_id IS NULL OR device_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_org_profile_device
  ON public.push_tokens (organization_id, profile_id, device_id)
  WHERE device_id IS NOT NULL;

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: consume_rate_limit (SECURITY DEFINER) only.

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
