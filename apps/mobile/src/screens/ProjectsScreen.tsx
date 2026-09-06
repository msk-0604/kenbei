import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { PROJECT_STATUS_LABELS, colors } from "../theme";
import { formatPeriod } from "../lib/dates";
import { hasOrganization, useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { useProjectCapture } from "../lib/use-project-capture";
import type { MainTabParamList, ProjectsStackParamList } from "../navigation";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  planned_start_on: string | null;
  planned_end_on: string | null;
};

export function ProjectsScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("id, name, status, planned_start_on, planned_end_on")
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);
    setRows((data as ProjectRow[] | null) ?? []);
    setLoading(false);
  }, [workspace]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!hasOrganization(workspace)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>会社に参加すると現場が表示されます。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.title}>現場</Text>}
        ListEmptyComponent={
          loading ? null : <Text style={styles.muted}>現場がありません。Web で作成できます。</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("ProjectDetail", { projectId: item.id, name: item.name })}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>{PROJECT_STATUS_LABELS[item.status] ?? item.status}</Text>
            <Text style={styles.meta}>{formatPeriod(item.planned_start_on, item.planned_end_on)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

export function ProjectDetailScreen() {
  const route = useRoute<RouteProp<ProjectsStackParamList, "ProjectDetail">>();
  const { workspace } = useSession();
  const capture = useProjectCapture();
  const navigation = useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>();
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const [row, setRow] = useState<ProjectRow | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, status, planned_start_on, planned_end_on")
      .eq("id", route.params.projectId)
      .is("deleted_at", null)
      .maybeSingle();
    setRow((data as ProjectRow | null) ?? null);
  }, [route.params.projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const name = row?.name ?? route.params.name;
  const projectId = route.params.projectId;

  return (
    <ScrollView style={styles.detail} contentContainerStyle={{ paddingBottom: 40 }}>
      <capture.CapturePreviewModal />
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.meta}>{workspace?.organizationName}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>状態</Text>
        <Text style={styles.cardTitle}>
          {row ? (PROJECT_STATUS_LABELS[row.status] ?? row.status) : "読み込み中…"}
        </Text>
        <Text style={[styles.label, { marginTop: 16 }]}>期間</Text>
        <Text style={styles.cardTitle}>{row ? formatPeriod(row.planned_start_on, row.planned_end_on) : "—"}</Text>
      </View>
      {capture.message ? <Text style={styles.muted}>{capture.message}</Text> : null}
      <Pressable style={styles.primary} onPress={() => void capture.startCamera(projectId, name)}>
        <Text style={styles.primaryText}>撮影</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => void capture.startLibrary(projectId, name)}>
        <Text style={styles.secondaryText}>ライブラリから選ぶ</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() =>
          tabs?.navigate("Photos", { screen: "PhotosList", params: { projectId, projectName: name } })
        }
      >
        <Text style={styles.secondaryText}>この現場の写真</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() =>
          tabs?.navigate("Account", { screen: "TasksList", params: { projectId, projectName: name } })
        }
      >
        <Text style={styles.secondaryText}>この現場のタスク</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() =>
          tabs?.navigate("Account", { screen: "ReportsList", params: { projectId, projectName: name } })
        }
      >
        <Text style={styles.secondaryText}>この現場の日報</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate("DrawingsList", { projectId, projectName: name })}
      >
        <Text style={styles.secondaryText}>この現場の図面</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate("ProjectChat", { projectId, projectName: name })}
      >
        <Text style={styles.secondaryText}>この現場のチャット</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => navigation.navigate("ProjectGantt", { projectId, projectName: name })}
      >
        <Text style={styles.secondaryText}>この現場の工程</Text>
      </Pressable>
      <Text style={styles.muted}>似た現場・AI要約は Web の現場概要で確認できます。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.paper },
  list: { padding: 20, paddingBottom: 40 },
  detail: { flex: 1, backgroundColor: colors.paper, padding: 20 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 16, color: colors.ink },
  muted: { color: colors.muted, marginTop: 8, fontSize: 15, lineHeight: 22 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 14 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 88,
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  primary: {
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: 16,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryText: { color: colors.ink, fontWeight: "600", fontSize: 16 },
});
