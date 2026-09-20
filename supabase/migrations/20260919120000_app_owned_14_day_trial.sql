-- App-owned 14-day trial for NEW organizations only.
-- Leaves existing organization_billing rows untouched.
-- Additive function replace only. No RLS or service role changes.

CREATE OR REPLACE FUNCTION public.ensure_organization_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_billing (organization_id, plan_code, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'trialing', now() + interval '14 days')
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_organization_billing_row(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_billing (organization_id, plan_code, status, trial_ends_at)
  VALUES (p_org, 'free', 'trialing', now() + interval '14 days')
  ON CONFLICT (organization_id) DO NOTHING;

  PERFORM 1
  FROM public.organization_billing
  WHERE organization_id = p_org
  FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_organization_billing_row(uuid) FROM PUBLIC, anon, authenticated;
