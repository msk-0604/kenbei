import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { colors } from "../theme";
import { formatDateTime } from "../lib/dates";
import { usePhotoQueue } from "../lib/photo-queue-context";
import { supabase } from "../lib/supabase";
import { signedPhotoUrl } from "../lib/photo-urls";
import { SyncBadge } from "../components/SyncBadge";
import type { PhotosStackParamList } from "../navigation";

type RemoteDetail = {
  id: string;
  projectName: string | null;
  takenAt: string;
  capturedByName: string | null;
  comment: string | null;
  storagePath: string;
  url: string | null;
  classificationStatus: string;
  proposedDescription: string | null;
  workTypeKey: string | null;
};

export function PhotoDetailScreen() {
  const route = useRoute<RouteProp<PhotosStackParamList, "PhotoDetail">>();
  const { items, retryPhoto } = usePhotoQueue();
  const [remote, setRemote] = useState<RemoteDetail | null>(null);
  const [loading, setLoading] = useState(route.params.source === "remote");

  const local = items.find((item) => item.localId === route.params.photoId) ?? null;

  const loadRemote = useCallback(async () => {
    if (route.params.source !== "remote") {
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("photos")
      .select(
        "id, taken_at, comment, classification_status, proposed_description, work_type_key, storage_path, projects(name), profiles:captured_by(display_name)",
      )
      .eq("id", route.params.photoId)
      .is("deleted_at", null)
      .maybeSingle();
    const row = data as {
      id: string;
      taken_at: string;
      comment: string | null;
      classification_status: string;
      proposed_description: string | null;
      work_type_key: string | null;
      storage_path: string;
      projects: { name: string } | { name: string }[] | null;
      profiles: { display_name: string } | { display_name: string }[] | null;
    } | null;
    if (!row) {
      setRemote(null);
      setLoading(false);
      return;
    }
    setRemote({
      id: row.id,
      projectName: Array.isArray(row.projects) ? row.projects[0]?.name ?? null : row.projects?.name ?? null,
      takenAt: row.taken_at,
      capturedByName: Array.isArray(row.profiles)
        ? row.profiles[0]?.display_name ?? null
        : row.profiles?.display_name ?? null,
      comment: row.comment,
      storagePath: row.storage_path,
      url: await signedPhotoUrl(row.storage_path, { width: 1600 }),
      classificationStatus: row.classification_status,
      proposedDescription: row.proposed_description,
      workTypeKey: row.work_type_key,
    });
    setLoading(false);
  }, [route.params.photoId, route.params.source]);

  useFocusEffect(
    useCallback(() => {
      void loadRemote();
    }, [loadRemote]),
  );

  if (local) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Image source={{ uri: local.localFileUri }} style={styles.image} resizeMode="contain" />
        <Text style={styles.title}>{local.projectName}</Text>
        <Text style={styles.meta}>{formatDateTime(local.capturedAt)}</Text>
        <Text style={styles.meta}>{local.capturedByName}</Text>
        <Text style={styles.meta}>
          {local.width}×{local.height} · {Math.round(local.size / 1024)} KB
        </Text>
        <SyncBadge status={local.status} progress={local.progress} onRetry={() => void retryPhoto(local.localId)} />
        {local.lastError ? <Text style={styles.error}>{local.lastError}</Text> : null}
        <Text style={styles.hint}>コメントは同期後に Web でも整理できます。</Text>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!remote) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>写真を開けません。権限または削除を確認してください。</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {remote.url ? (
        <Image source={{ uri: remote.url }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
      <Text style={styles.title}>{remote.projectName ?? "現場"}</Text>
      <Text style={styles.meta}>{formatDateTime(remote.takenAt)}</Text>
      <Text style={styles.meta}>{remote.capturedByName ?? "—"}</Text>
      {remote.comment ? <Text style={styles.body}>{remote.comment}</Text> : <Text style={styles.meta}>コメントなし</Text>}
      <SyncBadge status="synced" />
      {remote.classificationStatus !== "none" ? (
        <View style={styles.ai}>
          <Text style={styles.label}>分類（読み取り）</Text>
          <Text style={styles.meta}>{remote.classificationStatus}</Text>
          {remote.workTypeKey ? <Text style={styles.meta}>{remote.workTypeKey}</Text> : null}
          {remote.proposedDescription ? <Text style={styles.body}>{remote.proposedDescription}</Text> : null}
        </View>
      ) : null}
      <Pressable onPress={() => void loadRemote()} style={styles.refresh}>
        <Text style={styles.refreshText}>画像を再読み込み</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  image: { width: "100%", height: 360, borderRadius: 16, backgroundColor: "#0F172A" },
  placeholder: { backgroundColor: colors.line },
  title: { marginTop: 16, fontSize: 22, fontWeight: "700", color: colors.ink },
  meta: { marginTop: 6, color: colors.muted, fontSize: 15 },
  body: { marginTop: 12, fontSize: 16, lineHeight: 24, color: colors.ink },
  hint: { marginTop: 16, color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { marginTop: 10, color: colors.danger },
  ai: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 6 },
  refresh: { minHeight: 48, justifyContent: "center", marginTop: 12 },
  refreshText: { color: colors.muted, fontWeight: "600" },
});
