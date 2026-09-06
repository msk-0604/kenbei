import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { brand, colors } from "../theme";
import { formatTokyoDate, tokyoTodayIso } from "../lib/dates";
import { hasOrganization, useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { usePhotoQueue } from "../lib/photo-queue-context";
import type { MainTabParamList } from "../navigation";

type Counts = {
  todayTasks: number;
  pendingConfirm: number;
};

export function TodayScreen() {
  const { workspace } = useSession();
  const { pendingCount, flush } = usePhotoQueue();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({ todayTasks: 0, pendingConfirm: 0 });

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const today = tokyoTodayIso();
    const orgId = workspace.organizationId;
    const [tasks, captures, photos] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("due_on", today)
        .neq("status", "done")
        .is("deleted_at", null),
      supabase
        .from("capture_fields")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .is("deleted_at", null),
      supabase
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("classification_status", "proposed")
        .is("deleted_at", null),
    ]);
    setCounts({
      todayTasks: tasks.count ?? 0,
      pendingConfirm: (captures.count ?? 0) + (photos.count ?? 0),
    });
    setLoading(false);
  }, [workspace]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void flush();
    }, [load, flush]),
  );

  if (!hasOrganization(workspace)) {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>{brand.name}</Text>
        <Text style={styles.title}>会社がまだありません</Text>
        <Text style={styles.muted}>Web で会社を作成してから、同じアカウントで入ってください。</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.brand}>{brand.name}</Text>
      <Text style={styles.tagline}>{brand.tagline}</Text>
      <Text style={styles.org}>{workspace?.organizationName}</Text>
      <Text style={styles.date}>{formatTokyoDate()}</Text>

      {pendingCount > 0 ? (
        <Pressable
          style={styles.photoBanner}
          onPress={() => navigation.navigate("Photos", { screen: "PhotosList" })}
        >
          <Text style={styles.photoBannerText}>未同期の写真 {pendingCount}枚</Text>
          <Text style={styles.photoBannerSub}>タップして同期状態を確認</Text>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <Pressable style={styles.stat} onPress={() => navigation.navigate("Account", { screen: "TasksList" })}>
          <Text style={styles.statLabel}>今日のタスク</Text>
          {loading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.statValue}>{counts.todayTasks}</Text>
          )}
        </Pressable>
        <Pressable style={styles.stat} onPress={() => navigation.navigate("Confirm")}>
          <Text style={styles.statLabel}>確認待ち</Text>
          {loading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.statValue}>{counts.pendingConfirm}</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.cta} onPress={() => navigation.navigate("Projects", { screen: "ProjectsList" })}>
        <Text style={styles.ctaTitle}>現場を見る</Text>
        <Text style={styles.ctaSub}>一覧から現場と期間を確認できます</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryCta}
        onPress={() => navigation.navigate("Account", { screen: "TasksList" })}
      >
        <Text style={styles.secondaryCtaText}>タスク</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryCta}
        onPress={() => navigation.navigate("Account", { screen: "ReportsList" })}
      >
        <Text style={styles.secondaryCtaText}>日報</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.paper },
  brand: { fontSize: 28, fontWeight: "700", color: colors.ink, letterSpacing: 1 },
  tagline: { marginTop: 8, fontSize: 16, color: colors.ink, fontWeight: "600" },
  org: { marginTop: 28, fontSize: 18, fontWeight: "600", color: colors.ink },
  date: { marginTop: 6, fontSize: 15, color: colors.muted },
  photoBanner: {
    marginTop: 20,
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 16,
    minHeight: 64,
    justifyContent: "center",
  },
  photoBannerText: { color: colors.warn, fontWeight: "700", fontSize: 16 },
  photoBannerSub: { marginTop: 4, color: colors.muted, fontSize: 13 },
  title: { marginTop: 16, fontSize: 22, fontWeight: "600", color: colors.ink },
  muted: { marginTop: 8, fontSize: 15, color: colors.muted, lineHeight: 22 },
  row: { flexDirection: "row", gap: 12, marginTop: 28 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    minHeight: 108,
    justifyContent: "space-between",
  },
  statLabel: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  statValue: { marginTop: 12, fontSize: 32, fontWeight: "700", color: colors.ink },
  cta: {
    marginTop: 20,
    backgroundColor: colors.ink,
    borderRadius: 18,
    padding: 20,
    minHeight: 88,
    justifyContent: "center",
  },
  ctaTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  ctaSub: { color: "#CBD5E1", marginTop: 6, fontSize: 14 },
  secondaryCta: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    minHeight: 56,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryCtaText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
});
