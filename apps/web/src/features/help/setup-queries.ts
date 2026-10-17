import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SAMPLE_PREFIX, SAMPLE_SOURCE } from "@/features/help/sample-data";
import type { SetupState } from "@/features/help/setup-checklist";

/** 「はじめにやること」の進み具合。見本データは数えない。読めないものは「まだ」として扱う。 */
export async function getSetupState(organizationId: string): Promise<SetupState & { hasSample: boolean }> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const head = { count: "exact" as const, head: true };

  const samples = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source", SAMPLE_SOURCE)
    .is("deleted_at", null);
  const sampleIds = ((samples.data as { id: string }[] | null) ?? []).map((row) => row.id);
  const notSample = sampleIds.length > 0 ? `(${sampleIds.join(",")})` : null;

  const schedules = () => {
    const query = supabase.from("schedules").select("id", head).eq("organization_id", organizationId);
    return notSample ? query.not("project_id", "in", notSample) : query;
  };

  const [workers, sites, scheduleCount, started, passcode] = await Promise.all([
    supabase
      .from("workers")
      .select("id", head)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .not("name", "like", `${SAMPLE_PREFIX}%`),
    supabase
      .from("projects")
      .select("id", head)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("source", SAMPLE_SOURCE),
    schedules(),
    schedules().not("actual_start_time", "is", null),
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
    scheduleCount: scheduleCount.count ?? 0,
    workStarted: (started.count ?? 0) > 0,
    hasSample: sampleIds.length > 0,
  };
}
