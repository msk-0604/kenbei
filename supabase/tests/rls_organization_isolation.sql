-- Manual / CI helper. Requires two authenticated roles in one database.
-- Expected: org A member cannot SELECT org B projects, financials, or memberships.

-- 1. Sign up user_a and user_b.
-- 2. user_a: SELECT create_organization('会社A');
-- 3. user_b: SELECT create_organization('会社B');
-- 4. As user_a:

-- SELECT count(*) FROM organizations;
-- Expect: 1 (会社A only)

-- SELECT * FROM projects;
-- Expect: only organization_id = 会社A

-- INSERT INTO projects (organization_id, name) VALUES ('<org-b-id>', '侵入');
-- Expect: policy violation

-- SELECT * FROM work_events;
-- Expect: none from org B

-- SELECT * FROM capture_fields;
-- Expect: none from org B

-- SELECT * FROM project_messages WHERE organization_id = '<org-b>';
-- Expect: 0. Chat is project-scoped via auth_can_access_project.

-- SELECT * FROM export_jobs WHERE organization_id = '<org-b>';
-- Expect: 0

-- Storage download org B path as org A:
-- Expect: policy violation

-- Invite token of org B accepted by org A email mismatch:
-- Expect: exception

-- Billing entitlement is server-side; inserting membership beyond plan is app-enforced.
-- organization_billing of org B must not be readable? (org member of A: 0 rows)

-- Invite: user_a cannot accept org B token unless email matches invitation.

-- Export isolation: processExportJob filters every row with exportJobOrgSafe(orgA, row.organization_id)

-- Similar Projects / AI: catalog and prompts are filtered by organization_id from the server session, never from a client-claimed org id.

-- SELECT * FROM ops_signals WHERE organization_id = '<org-b>';
-- Expect: 0

-- SELECT * FROM audit_logs;
-- Expect: Owner/Executive only. INSERT from client must fail.
