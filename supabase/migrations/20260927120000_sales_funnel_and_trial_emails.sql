-- Sales funnel events and trial lifecycle email history.
-- Additive. Service role only. Does not change billing, RLS of existing tables, or trial length.

CREATE TABLE IF NOT EXISTS public.sales_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  organization_id uuid REFERENCES public.organizations (id),
  event_kind text NOT NULL CHECK (event_kind IN ('visit', 'trial_started', 'paid')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_path text,
  plan_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_funnel_events_visit_visitor_uidx
  ON public.sales_funnel_events (visitor_id)
  WHERE event_kind = 'visit';

CREATE UNIQUE INDEX IF NOT EXISTS sales_funnel_events_org_kind_uidx
  ON public.sales_funnel_events (organization_id, event_kind)
  WHERE organization_id IS NOT NULL
    AND event_kind IN ('trial_started', 'paid');

CREATE INDEX IF NOT EXISTS sales_funnel_events_kind_created_idx
  ON public.sales_funnel_events (event_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.trial_lifecycle_emails (
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  kind text NOT NULL CHECK (kind IN ('trial_started', 'trial_day3', 'trial_ending_soon')),
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, kind)
);

CREATE INDEX IF NOT EXISTS trial_lifecycle_emails_retry_idx
  ON public.trial_lifecycle_emails (status, next_retry_at)
  WHERE status = 'failed';

ALTER TABLE public.sales_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_lifecycle_emails ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sales_funnel_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trial_lifecycle_emails FROM PUBLIC, anon, authenticated;
