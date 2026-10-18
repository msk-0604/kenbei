-- 契約の状態（organization_billing）は、サーバー（service_role）と SECURITY DEFINER の関数だけが書く。
-- これまでは会社の管理者（org.manage）が、ブラウザから Supabase に直接
-- status = 'active' などを書き込めてしまい、支払わずに有料の状態にできた。
-- アプリは常に service_role で書いているので、読み取りはそのまま、書き込みだけを閉じる。

DROP POLICY IF EXISTS organization_billing_update ON public.organization_billing;
DROP POLICY IF EXISTS organization_billing_insert ON public.organization_billing;

REVOKE INSERT, UPDATE, DELETE ON public.organization_billing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organization_billing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_billing TO service_role;
