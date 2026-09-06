-- KenSapo migration 6/6: grants and RLS. Tenant isolation is enforced here, not only in app code.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON TABLE public.jobs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.permissions FROM anon, authenticated;
GRANT SELECT ON TABLE public.permissions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.system_catalogs FROM anon, authenticated;
GRANT SELECT ON TABLE public.system_catalogs TO authenticated;
REVOKE INSERT ON TABLE public.organizations FROM authenticated;
REVOKE INSERT ON TABLE public.organization_settings FROM authenticated;
REVOKE INSERT ON TABLE public.organization_security_settings FROM authenticated;
REVOKE INSERT ON TABLE public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.org_daily_snapshots FROM authenticated;
GRANT SELECT ON TABLE public.org_daily_snapshots TO authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'organizations', 'organization_settings', 'organization_security_settings',
    'branches', 'departments', 'teams', 'partner_companies', 'roles', 'role_permissions',
    'memberships', 'membership_project_access', 'user_qualifications', 'organization_invitations',
    'organization_catalogs', 'customers', 'customer_contacts', 'materials', 'projects',
    'project_sites', 'project_work_types', 'project_members', 'project_financials',
    'estimate_items', 'budget_items', 'cost_entries', 'processes', 'process_progress',
    'labor_entries', 'material_usages', 'change_orders', 'incidents', 'incident_causes',
    'incident_actions', 'project_outcomes', 'lessons', 'site_sessions', 'captures',
    'capture_fields', 'daily_reports', 'photos', 'documents', 'document_extractions',
    'knowledge_entries', 'knowledge_links', 'project_features', 'project_similarities',
    'signals', 'signal_feedback', 'import_jobs', 'import_rows', 'jobs',
    'org_daily_snapshots', 'audit_logs', 'permissions', 'system_catalogs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Profiles
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships mine
        JOIN public.memberships theirs ON theirs.organization_id = mine.organization_id
        WHERE mine.profile_id = auth.uid()
          AND mine.status = 'active'
          AND mine.deleted_at IS NULL
          AND theirs.profile_id = profiles.id
          AND theirs.status = 'active'
          AND theirs.deleted_at IS NULL
      )
    )
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Organizations
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND id IN (SELECT public.auth_organization_ids()));

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.auth_has_permission(id, 'org.manage'))
  WITH CHECK (id IN (SELECT public.auth_organization_ids()));

CREATE POLICY organization_settings_select ON public.organization_settings
  FOR SELECT TO authenticated
  USING (public.auth_is_org_member(organization_id));

CREATE POLICY organization_settings_update ON public.organization_settings
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));

CREATE POLICY organization_security_settings_select ON public.organization_security_settings
  FOR SELECT TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.security'));

CREATE POLICY organization_security_settings_update ON public.organization_security_settings
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.security'))
  WITH CHECK (public.auth_has_permission(organization_id, 'org.security'));

-- Optional org tree
CREATE POLICY branches_select ON public.branches
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));
CREATE POLICY branches_insert ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));
CREATE POLICY branches_update ON public.branches
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.manage'))
  WITH CHECK (public.auth_is_org_member(organization_id));

CREATE POLICY departments_select ON public.departments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));
CREATE POLICY departments_insert ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));
CREATE POLICY departments_update ON public.departments
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.manage'))
  WITH CHECK (public.auth_is_org_member(organization_id));

CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));
CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'org.manage'));
CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'org.manage'))
  WITH CHECK (public.auth_is_org_member(organization_id));

CREATE POLICY partner_companies_select ON public.partner_companies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));
CREATE POLICY partner_companies_write ON public.partner_companies
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'member.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'member.manage'));

-- RBAC catalog
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY system_catalogs_select ON public.system_catalogs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (organization_id IS NULL OR public.auth_is_org_member(organization_id))
  );

CREATE POLICY roles_write ON public.roles
  FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_system = false
    AND public.auth_has_permission(organization_id, 'role.manage')
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND is_system = false
    AND public.auth_has_permission(organization_id, 'role.manage')
  );

CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_id
        AND r.deleted_at IS NULL
        AND (r.organization_id IS NULL OR public.auth_is_org_member(r.organization_id))
    )
  );

CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND r.is_system = false
        AND public.auth_has_permission(r.organization_id, 'role.manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND r.is_system = false
        AND public.auth_has_permission(r.organization_id, 'role.manage')
    )
  );

CREATE POLICY memberships_select ON public.memberships
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));

CREATE POLICY memberships_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'member.manage'));

CREATE POLICY memberships_update ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'member.manage'))
  WITH CHECK (public.auth_is_org_member(organization_id));

CREATE POLICY membership_project_access_select ON public.membership_project_access
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (
      public.auth_has_permission(organization_id, 'member.manage')
      OR EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.id = membership_id AND m.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY membership_project_access_write ON public.membership_project_access
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'member.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'member.manage'));

CREATE POLICY user_qualifications_select ON public.user_qualifications
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));

CREATE POLICY user_qualifications_write ON public.user_qualifications
  FOR ALL TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'member.manage')
    OR profile_id = auth.uid()
  )
  WITH CHECK (public.auth_is_org_member(organization_id));

CREATE POLICY organization_invitations_all ON public.organization_invitations
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'member.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'member.manage'));

CREATE POLICY organization_catalogs_select ON public.organization_catalogs
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));

CREATE POLICY organization_catalogs_write ON public.organization_catalogs
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'catalog.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'catalog.manage'));

CREATE POLICY materials_select ON public.materials
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_is_org_member(organization_id));

CREATE POLICY materials_write ON public.materials
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'catalog.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'catalog.manage'));

-- Customers: partners/workers only see customers of accessible projects
CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (
      public.auth_has_permission(organization_id, 'project.read_all')
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.customer_id = customers.id
          AND p.deleted_at IS NULL
          AND public.auth_can_access_project(p.organization_id, p.id)
      )
    )
  );

CREATE POLICY customers_write ON public.customers
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.create')
    OR public.auth_has_permission(organization_id, 'project.update'));

CREATE POLICY customer_contacts_select ON public.customer_contacts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id AND c.deleted_at IS NULL
    )
    AND public.auth_is_org_member(organization_id)
    AND (
      public.auth_has_permission(organization_id, 'project.read_all')
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.customer_id = customer_contacts.customer_id
          AND public.auth_can_access_project(p.organization_id, p.id)
      )
    )
  );

CREATE POLICY customer_contacts_write ON public.customer_contacts
  FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_is_org_member(organization_id));

-- Projects
CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND public.auth_can_access_project(organization_id, id)
  );

CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'project.create'));

CREATE POLICY projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_has_permission(organization_id, 'project.update')
    AND public.auth_can_access_project(organization_id, id)
  )
  WITH CHECK (public.auth_is_org_member(organization_id));

-- Project-scoped children
CREATE POLICY project_sites_select ON public.project_sites FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY project_work_types_select ON public.project_work_types FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY project_members_select ON public.project_members FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY processes_select ON public.processes FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY process_progress_select ON public.process_progress FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY labor_entries_select ON public.labor_entries FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY material_usages_select ON public.material_usages FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY change_orders_select ON public.change_orders FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY incidents_select ON public.incidents FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY lessons_select ON public.lessons FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY site_sessions_select ON public.site_sessions FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY daily_reports_select ON public.daily_reports FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY photos_select ON public.photos FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id)) AND public.auth_is_org_member(organization_id));
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id)) AND public.auth_is_org_member(organization_id));
CREATE POLICY project_features_select ON public.project_features FOR SELECT TO authenticated
  USING (public.auth_can_access_project(organization_id, project_id));
CREATE POLICY project_similarities_select ON public.project_similarities FOR SELECT TO authenticated
  USING (public.auth_can_access_project(organization_id, seed_project_id));

CREATE POLICY project_outcomes_select ON public.project_outcomes FOR SELECT TO authenticated
  USING (public.auth_can_access_project(organization_id, project_id));

CREATE POLICY incident_causes_select ON public.incident_causes FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND public.auth_can_access_project(i.organization_id, i.project_id)
    )
  );

CREATE POLICY incident_actions_select ON public.incident_actions FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND public.auth_can_access_project(i.organization_id, i.project_id)
    )
  );

CREATE POLICY document_extractions_select ON public.document_extractions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND d.deleted_at IS NULL
        AND (d.project_id IS NULL OR public.auth_can_access_project(d.organization_id, d.project_id))
    )
  );

-- Writes for graph children
CREATE POLICY project_children_insert_sites ON public.project_sites FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY project_children_update_sites ON public.project_sites FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id));

CREATE POLICY project_work_types_write ON public.project_work_types FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id));

CREATE POLICY project_members_write ON public.project_members FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'member.manage') OR public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_can_access_project(organization_id, project_id) OR public.auth_has_permission(organization_id, 'project.read_all'));

CREATE POLICY processes_write ON public.processes FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id));

CREATE POLICY process_progress_write ON public.process_progress FOR ALL TO authenticated
  USING (public.auth_can_access_project(organization_id, project_id) AND public.auth_has_permission(organization_id, 'capture.confirm'))
  WITH CHECK (public.auth_can_access_project(organization_id, project_id));

CREATE POLICY labor_entries_write ON public.labor_entries FOR ALL TO authenticated
  USING (public.auth_can_access_project(organization_id, project_id) AND (public.auth_has_permission(organization_id, 'project.update') OR public.auth_has_permission(organization_id, 'capture.confirm')))
  WITH CHECK (public.auth_can_access_project(organization_id, project_id));

CREATE POLICY material_usages_write ON public.material_usages FOR ALL TO authenticated
  USING (public.auth_can_access_project(organization_id, project_id) AND (public.auth_has_permission(organization_id, 'project.update') OR public.auth_has_permission(organization_id, 'capture.confirm')))
  WITH CHECK (public.auth_can_access_project(organization_id, project_id));

CREATE POLICY change_orders_write ON public.change_orders FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update') AND public.auth_can_access_project(organization_id, project_id));

CREATE POLICY incidents_write ON public.incidents FOR ALL TO authenticated
  USING (public.auth_can_access_project(organization_id, project_id) AND public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_can_access_project(organization_id, project_id));

CREATE POLICY incident_causes_write ON public.incident_causes FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update'));

CREATE POLICY incident_actions_write ON public.incident_actions FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update'));

CREATE POLICY lessons_write ON public.lessons FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'knowledge.write') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_has_permission(organization_id, 'knowledge.write'));

CREATE POLICY project_outcomes_write ON public.project_outcomes FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'project.close') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_has_permission(organization_id, 'project.close'));

CREATE POLICY site_sessions_insert ON public.site_sessions FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'capture.create') AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY site_sessions_update ON public.site_sessions FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'capture.create') AND public.auth_can_access_project(organization_id, project_id));

CREATE POLICY daily_reports_write ON public.daily_reports FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'capture.confirm') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_can_access_project(organization_id, project_id));

CREATE POLICY photos_insert ON public.photos FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_permission(organization_id, 'photo.create')
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  );
CREATE POLICY photos_update ON public.photos FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'photo.create') AND public.auth_is_org_member(organization_id));

CREATE POLICY documents_write ON public.documents FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'import.manage') OR public.auth_has_permission(organization_id, 'project.update'))
  WITH CHECK (public.auth_is_org_member(organization_id));

-- Finance: explicit permission. Partner/Worker/Guest have none.
CREATE POLICY project_financials_select ON public.project_financials FOR SELECT TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'finance.read')
    AND public.auth_can_access_project(organization_id, project_id)
  );
CREATE POLICY project_financials_write ON public.project_financials FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'finance.write') AND public.auth_can_access_project(organization_id, project_id))
  WITH CHECK (public.auth_has_permission(organization_id, 'finance.write'));

CREATE POLICY estimate_items_select ON public.estimate_items FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_has_permission(organization_id, 'finance.read') AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY estimate_items_write ON public.estimate_items FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'finance.write'))
  WITH CHECK (public.auth_has_permission(organization_id, 'finance.write'));

CREATE POLICY budget_items_select ON public.budget_items FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_has_permission(organization_id, 'finance.read') AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY budget_items_write ON public.budget_items FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'finance.write'))
  WITH CHECK (public.auth_has_permission(organization_id, 'finance.write'));

CREATE POLICY cost_entries_select ON public.cost_entries FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_has_permission(organization_id, 'finance.read') AND public.auth_can_access_project(organization_id, project_id));
CREATE POLICY cost_entries_write ON public.cost_entries FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'finance.write'))
  WITH CHECK (public.auth_has_permission(organization_id, 'finance.write'));

-- Captures keep proposal vs human correction; confirm is a separate permission
CREATE POLICY captures_select ON public.captures FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  );
CREATE POLICY captures_insert ON public.captures FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_has_permission(organization_id, 'capture.create')
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  );
CREATE POLICY captures_update ON public.captures FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'capture.create') AND public.auth_is_org_member(organization_id));

CREATE POLICY capture_fields_select ON public.capture_fields FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (project_id IS NULL OR public.auth_can_access_project(organization_id, project_id))
  );
CREATE POLICY capture_fields_insert ON public.capture_fields FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'capture.create'));
CREATE POLICY capture_fields_update ON public.capture_fields FOR UPDATE TO authenticated
  USING (public.auth_has_permission(organization_id, 'capture.confirm') AND public.auth_is_org_member(organization_id));

CREATE POLICY knowledge_entries_select ON public.knowledge_entries FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_has_permission(organization_id, 'knowledge.read'));
CREATE POLICY knowledge_entries_write ON public.knowledge_entries FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'knowledge.write'))
  WITH CHECK (public.auth_has_permission(organization_id, 'knowledge.write'));

CREATE POLICY knowledge_links_select ON public.knowledge_links FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.auth_has_permission(organization_id, 'knowledge.read'));
CREATE POLICY knowledge_links_write ON public.knowledge_links FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'knowledge.write'))
  WITH CHECK (public.auth_has_permission(organization_id, 'knowledge.write'));

CREATE POLICY signals_select ON public.signals FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_org_member(organization_id)
    AND (
      (visibility = 'management' AND public.auth_has_permission(organization_id, 'signal.read_management'))
      OR (
        visibility = 'project'
        AND project_id IS NOT NULL
        AND public.auth_can_access_project(organization_id, project_id)
      )
    )
  );

CREATE POLICY signal_feedback_select ON public.signal_feedback FOR SELECT TO authenticated
  USING (public.auth_is_org_member(organization_id));
CREATE POLICY signal_feedback_insert ON public.signal_feedback FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_permission(organization_id, 'signal.feedback'));

CREATE POLICY import_jobs_all ON public.import_jobs FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'import.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'import.manage'));

CREATE POLICY import_rows_all ON public.import_rows FOR ALL TO authenticated
  USING (public.auth_has_permission(organization_id, 'import.manage'))
  WITH CHECK (public.auth_has_permission(organization_id, 'import.manage'));

CREATE POLICY org_daily_snapshots_select ON public.org_daily_snapshots FOR SELECT TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'signal.read_management')
    OR public.auth_has_permission(organization_id, 'finance.read')
  );

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.auth_has_permission(organization_id, 'audit.read'));

CREATE POLICY project_features_write ON public.project_features FOR ALL TO authenticated
  USING (
    public.auth_has_permission(organization_id, 'project.update')
    AND public.auth_can_access_project(organization_id, project_id)
  )
  WITH CHECK (public.auth_has_permission(organization_id, 'project.update'));

-- jobs: RLS on, no authenticated policies => denied. service_role bypasses.
