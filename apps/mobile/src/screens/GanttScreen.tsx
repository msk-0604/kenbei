import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { colors } from "../theme";
import { isProcessDelayed } from "../lib/ops-logic";
import { tokyoTodayIso } from "../lib/dates";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { ProjectsStackParamList } from "../navigation";

type Row = {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  percent: number;
  status: string;
};

export function GanttScreen() {
  const { workspace } = useSession();
  const route = useRoute<RouteProp<ProjectsStackParamList, "ProjectGantt">>();
  const [rows, setRows] = useState<Row[]>([]);
  const today = tokyoTodayIso();

  useFocusEffect(
    useCallback(() => {
      if (!workspace?.organizationId) {
        return;
      }
      void supabase
        .from("processes")
        .select("id, name, planned_start_on, planned_end_on, percent, status")
        .eq("project_id", route.params.projectId)
        .eq("organization_id", workspace.organizationId)
        .is("deleted_at", null)
        .then(({ data }) => {
          setRows(
            ((data as {
              id: string;
              name: string;
              planned_start_on: string | null;
              planned_end_on: string | null;
              percent: number;
              status: string;
            }[] | null) ?? []).map((row) => ({
              id: row.id,
              name: row.name,
              start: row.planned_start_on,
              end: row.planned_end_on,
              percent: row.percent,
              status: row.status,
            })),
          );
        });
    }, [route.params.projectId, workspace]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{route.params.projectName} の工程</Text>
      {rows.map((row) => {
        const delayed = isProcessDelayed({
          status: row.status,
          percent: row.percent,
          plannedEndOn: row.end,
          todayIso: today,
        });
        return (
          <View key={row.id} style={[styles.card, delayed && styles.delayed]}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.meta}>
              {row.start ?? "—"} 〜 {row.end ?? "—"} / {row.percent}%{delayed ? " / 遅延" : ""}
            </Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${row.percent}%` }]} />
            </View>
          </View>
        );
      })}
      {rows.length === 0 ? <Text style={styles.meta}>工程はまだありません。</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.line },
  delayed: { borderColor: colors.danger, backgroundColor: "#FEF2F2" },
  name: { fontWeight: "700", fontSize: 16, color: colors.ink },
  meta: { marginTop: 4, color: colors.muted },
  bar: { marginTop: 10, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.ink },
});
