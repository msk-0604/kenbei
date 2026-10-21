import { NextResponse } from "next/server";
import { getMonthAttendance } from "@/features/attendance/queries";
import { attendanceCsv, normalizeMonth } from "@/features/attendance/summary";
import { isSiteAdmin } from "@/lib/authz-guard";
import { getWorkspace, hasOrganization } from "@/lib/session";
import { formatClockTime, todayISO } from "@/lib/site-dates";

export const dynamic = "force-dynamic";

/** 出面表を Excel で開ける CSV にする（管理者だけ） */
export async function GET(request: Request) {
  const workspace = await getWorkspace();
  if (!workspace || !hasOrganization(workspace) || !isSiteAdmin(workspace)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const month = normalizeMonth(new URL(request.url).searchParams.get("month"), todayISO());
  const workers = await getMonthAttendance(month);
  const csv = attendanceCsv(workers, (iso) => formatClockTime(iso));
  const name = `出面表_${month}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dezura-${month}.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
