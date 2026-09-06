import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { formatDateTime } from "../lib/dates";
import { PHOTO_QUEUE } from "../lib/photo-settings";
import { usePhotoQueue } from "../lib/photo-queue-context";
import { useProjectCapture } from "../lib/use-project-capture";
import { hasOrganization, useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { signedPhotoUrls } from "../lib/photo-urls";
import { SyncBadge } from "../components/SyncBadge";
import type { PhotosStackParamList } from "../navigation";
import type { PhotoQueueItem } from "../lib/photo-queue-logic";

type RemotePhoto = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  takenAt: string;
  capturedByName: string | null;
  comment: string | null;
  storagePath: string;
  thumbUrl: string | null;
  classificationStatus: string;
};

type ListRow =
  | { kind: "local"; item: PhotoQueueItem }
  | { kind: "remote"; item: RemotePhoto };

type ProjectOption = { id: string; name: string };

export function PhotosScreen() {
  const { workspace } = useSession();
  const { items, pendingCount, retryPhoto, retryAll, flush } = usePhotoQueue();
  const capture = useProjectCapture();
  const navigation = useNavigation<NativeStackNavigationProp<PhotosStackParamList>>();
  const route = useRoute<RouteProp<PhotosStackParamList, "PhotosList">>();
  const routeProjectId = route.params?.projectId;
  const routeProjectName = route.params?.projectName;
  const [projectId, setProjectId] = useState<string | undefined>(routeProjectId);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [remote, setRemote] = useState<RemotePhoto[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(80);
    setProjects((data as ProjectOption[] | null) ?? []);
  }, [workspace]);

  const loadRemote = useCallback(
    async (nextOffset: number, replace: boolean) => {
      if (!workspace?.organizationId) {
        return;
      }
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const to = nextOffset + PHOTO_QUEUE.pageSize - 1;
      let query = supabase
        .from("photos")
        .select(
          "id, project_id, taken_at, comment, classification_status, storage_path, projects(name), profiles:captured_by(display_name)",
        )
        .eq("organization_id", workspace.organizationId)
        .is("deleted_at", null)
        .order("taken_at", { ascending: false })
        .range(nextOffset, to);
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      type PhotoQueryRow = {
        id: string;
        project_id: string | null;
        taken_at: string;
        comment: string | null;
        classification_status: string;
        storage_path: string;
        projects: { name: string } | { name: string }[] | null;
        profiles: { display_name: string } | { display_name: string }[] | null;
      };
      const rows = (data as PhotoQueryRow[] | null) ?? [];
      const urls = await signedPhotoUrls(
        rows.map((row) => row.storage_path),
        { width: 320 },
      );
      const mapped: RemotePhoto[] = rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: Array.isArray(row.projects) ? row.projects[0]?.name ?? null : row.projects?.name ?? null,
        takenAt: row.taken_at,
        capturedByName: Array.isArray(row.profiles)
          ? row.profiles[0]?.display_name ?? null
          : row.profiles?.display_name ?? null,
        comment: row.comment,
        storagePath: row.storage_path,
        thumbUrl: urls.get(row.storage_path) ?? null,
        classificationStatus: row.classification_status,
      }));
      setRemote((prev) => (replace ? mapped : [...prev, ...mapped]));
      setOffset(nextOffset + mapped.length);
      setHasMore(mapped.length === PHOTO_QUEUE.pageSize);
      setLoading(false);
      setLoadingMore(false);
    },
    [workspace, projectId],
  );

  useFocusEffect(
    useCallback(() => {
      if (routeProjectId) {
        setProjectId(routeProjectId);
      }
      void loadProjects();
      void loadRemote(0, true);
      void flush();
    }, [loadProjects, loadRemote, flush, routeProjectId]),
  );

  const localRows = useMemo(
    () =>
      items.filter(
        (item) => item.status !== "synced" && (!projectId || item.projectId === projectId),
      ),
    [items, projectId],
  );

  const listData: ListRow[] = useMemo(
    () => [
      ...localRows.map((item) => ({ kind: "local" as const, item })),
      ...remote
        .filter((item) => !localRows.some((local) => local.localId === item.id))
        .map((item) => ({ kind: "remote" as const, item })),
    ],
    [localRows, remote],
  );

  function needProject(): ProjectOption | null {
    if (projectId) {
      const found = projects.find((row) => row.id === projectId);
      if (found) {
        return found;
      }
      if (routeProjectId && routeProjectName) {
        return { id: routeProjectId, name: routeProjectName };
      }
    }
    return null;
  }

  function withProject(action: (project: ProjectOption) => void) {
    const selected = needProject();
    if (selected) {
      action(selected);
      return;
    }
    if (projects.length === 0) {
      Alert.alert("現場がありません", "Web で現場を作成してください。");
      return;
    }
    const buttons = projects.slice(0, 6).map((row) => ({
      text: row.name,
      onPress: () => action(row),
    }));
    Alert.alert("現場を選ぶ", "写真を紐付ける現場を選んでください。", [
      ...buttons,
      { text: "キャンセル", style: "cancel" },
    ]);
  }

  if (!hasOrganization(workspace)) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>会社に参加すると写真を撮れます。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <capture.CapturePreviewModal />
      {pendingCount > 0 ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>未同期 {pendingCount}枚</Text>
          <Pressable onPress={() => void retryAll()} style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>再試行</Text>
          </Pressable>
        </View>
      ) : null}
      {capture.message ? <Text style={styles.note}>{capture.message}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          style={styles.primary}
          onPress={() => withProject((project) => void capture.startCamera(project.id, project.name))}
        >
          <Text style={styles.primaryText}>撮影</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => withProject((project) => void capture.startLibrary(project.id, project.name))}
        >
          <Text style={styles.secondaryText}>ライブラリ</Text>
        </Pressable>
      </View>
      <FlatList
        data={listData}
        keyExtractor={(row) => (row.kind === "local" ? `local-${row.item.localId}` : row.item.id)}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void loadRemote(0, true);
              void flush();
            }}
          />
        }
        onEndReached={() => {
          if (!loading && !loadingMore && hasMore) {
            void loadRemote(offset, false);
          }
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.muted}>写真はまだありません。</Text>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.ink} /> : null}
        renderItem={({ item }) =>
          item.kind === "local" ? (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate("PhotoDetail", { photoId: item.item.localId, source: "local" })
              }
            >
              <Image source={{ uri: item.item.localFileUri }} style={styles.thumb} />
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.item.projectName}
                </Text>
                <Text style={styles.sub}>{formatDateTime(item.item.capturedAt)}</Text>
                <Text style={styles.sub}>{item.item.capturedByName}</Text>
                <SyncBadge
                  status={item.item.status}
                  progress={item.item.progress}
                  onRetry={() => void retryPhoto(item.item.localId)}
                />
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("PhotoDetail", { photoId: item.item.id, source: "remote" })}
            >
              {item.item.thumbUrl ? (
                <Image source={{ uri: item.item.thumbUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.item.projectName ?? "現場"}
                </Text>
                <Text style={styles.sub}>{formatDateTime(item.item.takenAt)}</Text>
                <Text style={styles.sub}>{item.item.capturedByName ?? "—"}</Text>
                <SyncBadge status="synced" />
              </View>
            </Pressable>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  list: { padding: 16, paddingBottom: 40 },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerText: { color: colors.warn, fontWeight: "700" },
  bannerBtn: { minHeight: 40, paddingHorizontal: 12, justifyContent: "center" },
  bannerBtnText: { fontWeight: "700", color: colors.ink },
  note: { marginHorizontal: 16, marginTop: 8, color: colors.muted },
  actions: { flexDirection: "row", gap: 10, padding: 16 },
  primary: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.ink,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    marginBottom: 10,
    minHeight: 96,
  },
  thumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: colors.line },
  thumbEmpty: { backgroundColor: colors.line },
  meta: { flex: 1, marginLeft: 12, justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 2, color: colors.muted, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 15 },
});
