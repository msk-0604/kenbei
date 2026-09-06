import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { isSupabaseConfigured } from "./env";
import { supabase } from "./supabase";

const ORG_STORE_KEY = "kb_org";

export type WorkspaceOrg = {
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleCode: string;
  roleName: string;
};

export type Workspace = {
  userId: string;
  email: string | undefined;
  displayName: string;
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  organizations: WorkspaceOrg[];
};

type MembershipRow = {
  id: string;
  organization_id: string;
  organizations: { name: string } | { name: string }[] | null;
  roles: {
    code: string;
    name: string;
    role_permissions: { permission_code: string }[] | { permission_code: string } | null;
  } | {
    code: string;
    name: string;
    role_permissions: { permission_code: string }[] | { permission_code: string } | null;
  }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadWorkspace(user: User): Promise<Workspace> {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRow as { display_name: string } | null;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, organization_id, organizations(name), roles(code, name, role_permissions(permission_code))")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const rows = (memberships as MembershipRow[] | null) ?? [];
  const organizations: WorkspaceOrg[] = rows.map((item) => {
    const org = one(item.organizations);
    const role = one(item.roles);
    return {
      organizationId: item.organization_id,
      organizationName: org?.name ?? "",
      membershipId: item.id,
      roleCode: role?.code ?? "",
      roleName: role?.name ?? "",
    };
  });

  const stored = await SecureStore.getItemAsync(ORG_STORE_KEY).catch(() => null);
  const preferredRow = await supabase
    .from("profiles")
    .select("preferred_organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const preferred = (preferredRow.data as { preferred_organization_id: string | null } | null)
    ?.preferred_organization_id;
  const requested = stored || preferred || organizations[0]?.organizationId;
  const selected =
    organizations.find((item) => item.organizationId === requested) ?? organizations[0];
  const row = rows.find((item) => item.organization_id === selected?.organizationId) ?? rows[0];
  const org = one(row?.organizations);
  const role = one(row?.roles);
  const permRows = role?.role_permissions;
  const permissions = (Array.isArray(permRows) ? permRows : permRows ? [permRows] : [])
    .map((item) => item.permission_code)
    .filter(Boolean);

  return {
    userId: user.id,
    email: user.email,
    displayName: profile?.display_name ?? user.email ?? "ユーザー",
    organizationId: row?.organization_id ?? "",
    organizationName: org?.name ?? "",
    membershipId: row?.id ?? "",
    roleCode: role?.code ?? "",
    roleName: role?.name ?? "",
    permissions,
    organizations,
  };
}

type SessionContextValue = {
  loading: boolean;
  session: Session | null;
  workspace: Workspace | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next?.user) {
      setWorkspace(null);
      return;
    }
    setWorkspace(await loadWorkspace(next.user));
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      setWorkspace(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
    setLoading(false);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured()) {
      void Promise.resolve().then(() => {
        if (cancelled) {
          return;
        }
        setSession(null);
        setWorkspace(null);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next).finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    const { deactivatePushToken } = await import("./push-token");
    await deactivatePushToken(workspace);
    await supabase.auth.signOut();
    setWorkspace(null);
    setSession(null);
  }, [workspace]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      if (!workspace?.organizations.some((item) => item.organizationId === organizationId)) {
        return;
      }
      await SecureStore.setItemAsync(ORG_STORE_KEY, organizationId);
      await supabase.from("profiles").update({ preferred_organization_id: organizationId }).eq("id", workspace.userId);
      await refresh();
    },
    [refresh, workspace],
  );

  const value = useMemo(
    () => ({ loading, session, workspace, refresh, signOut, switchOrganization }),
    [loading, session, workspace, refresh, signOut, switchOrganization],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}

export function hasOrganization(workspace: Workspace | null): boolean {
  return Boolean(workspace?.organizationId);
}
