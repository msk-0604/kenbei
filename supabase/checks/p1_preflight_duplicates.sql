-- Run before applying 20260910120000_p1_seats_billing_unique.sql
-- Identifies duplicate rows that would block UNIQUE indexes.
-- Empty result set = safe to migrate.

-- 1) Same Stripe subscription on more than one organization (NULL / blank excluded)
SELECT
  stripe_subscription_id,
  count(*) AS organization_count,
  array_agg(organization_id ORDER BY organization_id) AS organization_ids
FROM public.organization_billing
WHERE stripe_subscription_id IS NOT NULL
  AND btrim(stripe_subscription_id) <> ''
GROUP BY stripe_subscription_id
HAVING count(*) > 1
ORDER BY organization_count DESC, stripe_subscription_id;

-- 2) Concurrent pending invites for the same org + email
SELECT
  organization_id,
  lower(email) AS email,
  count(*) AS pending_count,
  array_agg(id ORDER BY created_at) AS invitation_ids
FROM public.organization_invitations
WHERE deleted_at IS NULL
  AND accepted_at IS NULL
GROUP BY organization_id, lower(email)
HAVING count(*) > 1
ORDER BY pending_count DESC, organization_id, email;
