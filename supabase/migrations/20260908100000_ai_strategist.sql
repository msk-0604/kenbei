-- AI軍師: usage meter + authenticated audit writer (membership-scoped).

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid REFERENCES public.profiles (id),
  model text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT 'strategist',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_org_created
  ON public.ai_usage_events (organization_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_usage_events TO authenticated;

DROP POLICY IF EXISTS ai_usage_events_select ON public.ai_usage_events;
CREATE POLICY ai_usage_events_select ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (public.auth_is_org_member(organization_id));

CREATE OR REPLACE FUNCTION public.log_ai_strategist_event(
  p_organization_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_requested_action text DEFAULT '',
  p_tool text DEFAULT '',
  p_success boolean DEFAULT true,
  p_model text DEFAULT '',
  p_input_tokens integer DEFAULT 0,
  p_output_tokens integer DEFAULT 0,
  p_total_tokens integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.auth_is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_project_id IS NOT NULL AND NOT public.auth_can_access_project(p_organization_id, p_project_id) THEN
    RAISE EXCEPTION 'forbidden project';
  END IF;

  INSERT INTO public.audit_logs (
    organization_id,
    actor_profile_id,
    action,
    target_table,
    target_id,
    metadata
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    'ai.strategist',
    COALESCE(NULLIF(p_tool, ''), 'strategist'),
    p_project_id,
    jsonb_build_object(
      'requested_action', COALESCE(p_requested_action, ''),
      'tool', COALESCE(p_tool, ''),
      'success', p_success,
      'model', COALESCE(p_model, '')
    )
  );

  IF COALESCE(p_total_tokens, 0) > 0 OR COALESCE(p_model, '') <> '' THEN
    INSERT INTO public.ai_usage_events (
      organization_id,
      profile_id,
      model,
      purpose,
      input_tokens,
      output_tokens,
      total_tokens
    )
    VALUES (
      p_organization_id,
      auth.uid(),
      COALESCE(p_model, ''),
      'strategist',
      GREATEST(COALESCE(p_input_tokens, 0), 0),
      GREATEST(COALESCE(p_output_tokens, 0), 0),
      GREATEST(COALESCE(p_total_tokens, 0), 0)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_ai_strategist_event(uuid, uuid, text, text, boolean, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ai_strategist_event(uuid, uuid, text, text, boolean, text, integer, integer, integer) TO authenticated;
