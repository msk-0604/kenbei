-- READ-ONLY Production preflight for 20260922140000. No writes.
SELECT
  (SELECT count(*) FROM public.organizations WHERE deleted_at IS NULL) AS organizations_alive,
  (SELECT count(*) FROM public.memberships WHERE deleted_at IS NULL) AS memberships_alive,
  (SELECT count(*) FROM public.memberships WHERE deleted_at IS NULL AND status = 'active') AS memberships_active,
  (SELECT count(*) FROM public.organization_billing) AS billing_rows,
  (SELECT count(*) FROM public.organization_invitations WHERE deleted_at IS NULL AND accepted_at IS NULL AND expires_at > now()) AS pending_invites_open,
  (
    SELECT count(*)
    FROM public.organizations o
    WHERE o.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.memberships m
        JOIN public.roles r ON r.id = m.role_id
        WHERE m.organization_id = o.id
          AND m.deleted_at IS NULL
          AND m.status = 'active'
          AND r.code = 'owner'
      )
  ) AS orgs_without_active_owner,
  (
    SELECT count(*)
    FROM (
      SELECT m.organization_id
      FROM public.memberships m
      JOIN public.roles r ON r.id = m.role_id
      WHERE m.deleted_at IS NULL
        AND m.status = 'active'
        AND r.code = 'owner'
      GROUP BY m.organization_id
      HAVING count(*) > 1
    ) d
  ) AS orgs_with_multiple_active_owners,
  (
    SELECT coalesce(json_agg(json_build_object('code', x.code, 'n', x.n) ORDER BY x.code), '[]'::json)
    FROM (
      SELECT r.code, count(*)::int AS n
      FROM public.organization_invitations i
      JOIN public.roles r ON r.id = i.role_id
      WHERE i.deleted_at IS NULL
        AND i.accepted_at IS NULL
      GROUP BY r.code
    ) x
  ) AS pending_invite_roles,
  (
    SELECT count(*)
    FROM public.organization_invitations i
    JOIN public.roles r ON r.id = i.role_id
    WHERE i.deleted_at IS NULL
      AND i.accepted_at IS NULL
      AND r.code NOT IN ('worker', 'supervisor', 'manager')
  ) AS pending_invites_disallowed_role,
  (
    SELECT coalesce(json_agg(json_build_object('code', x.code, 'n', x.n) ORDER BY x.code), '[]'::json)
    FROM (
      SELECT r.code, count(*)::int AS n
      FROM public.memberships m
      JOIN public.roles r ON r.id = m.role_id
      WHERE m.deleted_at IS NULL
        AND m.status = 'active'
      GROUP BY r.code
    ) x
  ) AS active_membership_roles;
