import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SetupState } from "@/features/help/setup-checklist";

/** 「はじめにやること」の進み具合。読めないものは「まだ」として扱う。 */
export async function getSetupState(organizationId: string): Promise<SetupState> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const head = { count: "exact" as const, head: true };
  const [workers, sites, schedules, started, passcode] = await Promise.all([
    supabase.from("workers").select("id", head).eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("projects").select("id", head).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("schedules").select("id", head).eq("organization_id", organizationId),
    supabase
      .from("schedules")
      .select("id", head)
      .eq("organization_id", organizationId)
      .not("actual_start_time", "is", null),
    admin
      ? admin
          .from("organization_passcodes")
          .select("id", head)
          .eq("organization_id", organizationId)
          .eq("kind", "worker")
      : Promise.resolve({ count: 0 }),
  ]);
  return {
    workerCount: workers.count ?? 0,
    workerPasscodeSet: (passcode.count ?? 0) > 0,
    siteCount: sites.count ?? 0,
    scheduleCount: schedules.count ?? 0,
    workStarted: (started.count ?? 0) > 0,
  };
}
