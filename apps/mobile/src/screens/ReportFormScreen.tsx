import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { tokyoTodayIso } from "../lib/dates";
import { WEATHER_OPTIONS } from "../lib/ops-labels";
import { can } from "../lib/permissions";
import { emptyReportFields, preferReportDraft, togglePhotoId, type LocalReportDraft } from "../lib/report-draft-logic";
import { clearReportDraft, getReportDraft, saveReportDraft } from "../lib/report-draft-store";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { signedPhotoUrl } from "../lib/photo-urls";
import { notifyOrgMembers } from "../lib/notify-client";
import { ChipRow } from "../components/OpsUi";
import type { AccountStackParamList } from "../navigation";

type PhotoOption = { id: string; url: string | null; takenAt: string };

export function ReportFormScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const route = useRoute<RouteProp<AccountStackParamList, "ReportForm">>();
  const writable = can(workspace?.permissions ?? [], "capture.confirm");
  const workOn = route.params.workOn ?? tokyoTodayIso();
  const [draft, setDraft] = useState<LocalReportDraft | null>(null);
  const [photos, setPhotos] = useState<PhotoOption[]>([]);
  const [status, setStatus] = useState("draft");
  const [hint, setHint] = useState("端末に自動保存しています");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistLocal = useCallback(
    async (next: LocalReportDraft) => {
      await saveReportDraft(next);
      setHint("端末に保存済み。通信できれば同期します。");
    },
    [],
  );

  const patch = useCallback(
    (partial: Partial<LocalReportDraft>) => {
      setDraft((current) => {
        if (!current) {
          return current;
        }
        const next = { ...current, ...partial, updatedAt: Date.now() };
        if (timer.current) {
          clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => {
          void persistLocal(next);
        }, 500);
        return next;
      });
    },
    [persistLocal],
  );

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    const local = await getReportDraft(workspace.organizationId, route.params.projectId, workOn);
    let server: LocalReportDraft | null = null;
    let query = supabase
      .from("daily_reports")
      .select(
        "id, status, body, weather, work_location, worker_count, progress_note, issues, safety_notes, tomorrow_plan, remarks, updated_at",
      )
      .eq("organization_id", workspace.organizationId)
      .eq("project_id", route.params.projectId)
      .eq("work_on", workOn)
      .is("deleted_at", null);
    if (route.params.reportId) {
      query = supabase
        .from("daily_reports")
        .select(
          "id, status, body, weather, work_location, worker_count, progress_note, issues, safety_notes, tomorrow_plan, remarks, updated_at",
        )
        .eq("id", route.params.reportId)
        .eq("organization_id", workspace.organizationId)
        .is("deleted_at", null);
    }
    const { data } = await query.maybeSingle();
    const row = data as {
      id: string;
      status: string;
      body: string;
      weather: string | null;
      work_location: string | null;
      worker_count: number | null;
      progress_note: string | null;
      issues: string | null;
      safety_notes: string | null;
      tomorrow_plan: string | null;
      remarks: string | null;
      updated_at: string;
    } | null;
    let photoIds: string[] = [];
    if (row) {
      const links = await supabase
        .from("daily_report_photos")
        .select("photo_id")
        .eq("report_id", row.id)
        .is("deleted_at", null)
        .order("sort_order");
      photoIds = ((links.data as { photo_id: string }[] | null) ?? []).map((item) => item.photo_id);
      server = {
        organizationId: workspace.organizationId,
        projectId: route.params.projectId,
        projectName: route.params.projectName,
        workOn,
        reportId: row.id,
        updatedAt: new Date(row.updated_at).getTime(),
        syncedAt: new Date(row.updated_at).getTime(),
        body: row.body ?? "",
        weather: row.weather ?? "",
        workLocation: row.work_location ?? "",
        workerCount: row.worker_count != null ? String(row.worker_count) : "",
        progressNote: row.progress_note ?? "",
        issues: row.issues ?? "",
        safetyNotes: row.safety_notes ?? "",
        tomorrowPlan: row.tomorrow_plan ?? "",
        remarks: row.remarks ?? "",
        photoIds,
      };
      setStatus(row.status);
    }
    const empty: LocalReportDraft = {
      organizationId: workspace.organizationId,
      projectId: route.params.projectId,
      projectName: route.params.projectName,
      workOn,
      reportId: row?.id ?? null,
      updatedAt: Date.now(),
      syncedAt: null,
      ...emptyReportFields(),
    };
    const merged = local || server ? preferReportDraft(local, server) : empty;
    setDraft(merged);
    await persistLocal(merged);

    const { data: photoRows } = await supabase
      .from("photos")
      .select("id, taken_at, storage_path")
      .eq("organization_id", workspace.organizationId)
      .eq("project_id", route.params.projectId)
      .is("deleted_at", null)
      .gte("taken_at", `${workOn}T00:00:00+09:00`)
      .lte("taken_at", `${workOn}T23:59:59+09:00`)
      .order("taken_at", { ascending: false })
      .limit(24);
    const list =
      (photoRows as { id: string; taken_at: string; storage_path: string }[] | null) ?? [];
    const options: PhotoOption[] = [];
    for (const photo of list) {
      options.push({
        id: photo.id,
        takenAt: photo.taken_at,
        url: await signedPhotoUrl(photo.storage_path, { width: 240 }),
      });
    }
    setPhotos(options);
  }, [workspace, route.params.projectId, route.params.projectName, route.params.reportId, workOn, persistLocal]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        if (timer.current) {
          clearTimeout(timer.current);
        }
      };
    }, [load]),
  );

  async function syncToServer(next: LocalReportDraft, confirm: boolean): Promise<string | null> {
    if (!workspace?.organizationId || !writable) {
      return "日報を保存する権限がありません。";
    }
    const body = next.body.trim() || "（下書き）";
    const workerCount = Number(next.workerCount);
    const fields = {
      body,
      weather: next.weather || null,
      work_location: next.workLocation || null,
      worker_count: Number.isFinite(workerCount) && next.workerCount ? workerCount : null,
      progress_note: next.progressNote || null,
      issues: next.issues || null,
      safety_notes: next.safetyNotes || null,
      tomorrow_plan: next.tomorrowPlan || null,
      remarks: next.remarks || null,
      updated_by: workspace.userId,
      status: confirm ? "confirmed" : "draft",
      ...(confirm
        ? { confirmed_at: new Date().toISOString(), confirmed_by: workspace.userId }
        : {}),
    };
    let reportId = next.reportId;
    if (reportId) {
      const { error } = await supabase
        .from("daily_reports")
        .update(fields)
        .eq("id", reportId)
        .eq("organization_id", workspace.organizationId)
        .eq("status", "draft");
      if (error) {
        return error.message;
      }
    } else {
      const inserted = await supabase
        .from("daily_reports")
        .insert({
          ...fields,
          organization_id: workspace.organizationId,
          project_id: next.projectId,
          work_on: next.workOn,
          draft_source: "manual",
          created_by: workspace.userId,
        })
        .select("id")
        .maybeSingle();
      if (inserted.error?.code === "23505") {
        const existing = await supabase
          .from("daily_reports")
          .select("id")
          .eq("organization_id", workspace.organizationId)
          .eq("project_id", next.projectId)
          .eq("work_on", next.workOn)
          .is("deleted_at", null)
          .maybeSingle();
        reportId = (existing.data as { id: string } | null)?.id ?? null;
        if (!reportId) {
          return inserted.error.message;
        }
        const { error } = await supabase
          .from("daily_reports")
          .update(fields)
          .eq("id", reportId)
          .eq("organization_id", workspace.organizationId);
        if (error) {
          return error.message;
        }
      } else if (inserted.error || !inserted.data) {
        return inserted.error?.message ?? "日報を作成できませんでした。";
      } else {
        reportId = (inserted.data as { id: string }).id;
      }
    }
    await supabase.from("daily_report_photos").delete().eq("report_id", reportId);
    if (next.photoIds.length > 0) {
      const { error } = await supabase.from("daily_report_photos").insert(
        next.photoIds.slice(0, 12).map((photoId, index) => ({
          organization_id: workspace.organizationId,
          report_id: reportId,
          photo_id: photoId,
          sort_order: index,
          created_by: workspace.userId,
        })),
      );
      if (error) {
        return error.message;
      }
    }
    const saved = { ...next, reportId, syncedAt: Date.now() };
    setDraft(saved);
    if (confirm) {
      await clearReportDraft(next.organizationId, next.projectId, next.workOn);
      setStatus("confirmed");
      await notifyOrgMembers({
        organizationId: workspace.organizationId,
        projectId: next.projectId,
        kind: "report_confirm",
        title: "日報が確定されました",
        href: `/reports/${reportId}`,
        permissionAudience: "capture.confirm",
        extra: { reportId: reportId ?? "", projectId: next.projectId },
      });
    } else {
      await persistLocal(saved);
    }
    return null;
  }

  async function onSave(confirm: boolean) {
    if (!draft) {
      return;
    }
    setBusy(true);
    await persistLocal(draft);
    const error = await syncToServer(draft, confirm);
    setBusy(false);
    if (error) {
      Alert.alert(confirm ? "確定できません" : "同期できません", `${error}\n内容は端末に残しています。`);
      return;
    }
    setHint(confirm ? "確定しました" : "サーバーに保存しました");
    if (confirm) {
      navigation.goBack();
    }
  }

  if (!draft) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>読み込み中…</Text>
      </View>
    );
  }

  const locked = status === "confirmed";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>
        {draft.projectName} · {draft.workOn}
      </Text>
      <Text style={styles.hint}>{locked ? "確定済みです" : hint}</Text>
      <Text style={styles.label}>作業内容</Text>
      <TextInput
        style={[styles.input, styles.area]}
        value={draft.body}
        onChangeText={(body) => patch({ body })}
        placeholder="今日やったことを短く"
        multiline
        editable={!locked}
      />
      <Text style={styles.label}>天気</Text>
      <ChipRow
        value={draft.weather}
        onChange={(weather) => !locked && patch({ weather })}
        options={WEATHER_OPTIONS.map((item) => ({ value: item, label: item }))}
      />
      <Text style={styles.label}>明日</Text>
      <TextInput
        style={styles.input}
        value={draft.tomorrowPlan}
        onChangeText={(tomorrowPlan) => patch({ tomorrowPlan })}
        placeholder="任意"
        editable={!locked}
      />
      <Text style={styles.label}>写真を添付（当日の現場写真）</Text>
      <View style={styles.photos}>
        {photos.map((photo) => {
          const on = draft.photoIds.includes(photo.id);
          return (
            <Pressable
              key={photo.id}
              style={[styles.photo, on && styles.photoOn]}
              onPress={() => !locked && patch({ photoIds: togglePhotoId(draft.photoIds, photo.id) })}
            >
              {photo.url ? <Image source={{ uri: photo.url }} style={styles.thumb} /> : <View style={styles.thumb} />}
              <Text style={styles.photoMark}>{on ? "添付" : "追加"}</Text>
            </Pressable>
          );
        })}
      </View>
      {photos.length === 0 ? <Text style={styles.hint}>この日の同期済み写真がありません。</Text> : null}
      {!locked && writable ? (
        <>
          <Pressable style={styles.secondary} onPress={() => void onSave(false)} disabled={busy}>
            <Text style={styles.secondaryText}>{busy ? "保存中…" : "下書きを同期"}</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={() => void onSave(true)} disabled={busy}>
            <Text style={styles.primaryText}>確定</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  kicker: { fontSize: 18, fontWeight: "700", color: colors.ink },
  hint: { marginTop: 6, color: colors.muted, fontSize: 13 },
  label: { marginTop: 18, marginBottom: 8, fontWeight: "700", color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  area: { minHeight: 120, textAlignVertical: "top", paddingTop: 12 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: 96, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: colors.line },
  photoOn: { borderColor: colors.ink },
  thumb: { width: 92, height: 72, backgroundColor: colors.line },
  photoMark: { textAlign: "center", paddingVertical: 4, fontWeight: "700", fontSize: 12 },
  primary: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  secondary: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
});
