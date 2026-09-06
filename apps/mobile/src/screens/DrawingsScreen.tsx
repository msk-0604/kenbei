import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { colors } from "../theme";
import { ChipRow } from "../components/OpsUi";
import { DRAWING_KIND_LABELS, drawingStoragePath, MAX_DRAWING_BYTES, nextDrawingVersion } from "../lib/drawing-logic";
import { can } from "../lib/permissions";
import { PHOTO_BUCKET } from "../lib/photo-settings";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { ProjectsStackParamList } from "../navigation";

type DrawingRow = {
  id: string;
  seriesId: string;
  title: string;
  drawingKind: string | null;
  version: number;
  projectId: string;
};

export function DrawingsScreen() {
  const { workspace } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>();
  const route = useRoute<RouteProp<ProjectsStackParamList, "DrawingsList">>();
  const projectId = route.params.projectId;
  const projectName = route.params.projectName;
  const writable =
    can(workspace?.permissions ?? [], "project.update") || (workspace?.permissions ?? []).includes("import.manage");
  const [rows, setRows] = useState<DrawingRow[]>([]);
  const [title, setTitle] = useState("");
  const [drawingKind, setDrawingKind] = useState("plan");
  const [seriesId, setSeriesId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id, series_id, title, drawing_kind, version, project_id")
      .eq("organization_id", workspace.organizationId)
      .eq("project_id", projectId)
      .eq("category", "drawing")
      .eq("is_latest", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows(
      ((data as {
        id: string;
        series_id: string;
        title: string;
        drawing_kind: string | null;
        version: number;
        project_id: string;
      }[] | null) ?? []).map((row) => ({
        id: row.id,
        seriesId: row.series_id,
        title: row.title,
        drawingKind: row.drawing_kind,
        version: row.version,
        projectId: row.project_id,
      })),
    );
    setLoading(false);
  }, [workspace, projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function upload() {
    if (!writable || !workspace?.organizationId) {
      Alert.alert("権限がありません");
      return;
    }
    if (!title.trim() && !seriesId) {
      Alert.alert("図面名を入力してください。");
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) {
      return;
    }
    const asset = picked.assets[0];
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || !("size" in info) || !info.size) {
      Alert.alert("ファイルを読めませんでした。");
      return;
    }
    if (info.size > MAX_DRAWING_BYTES) {
      Alert.alert("ファイルが大きすぎます。");
      return;
    }
    setBusy(true);
    const existing = seriesId ? rows.find((row) => row.seriesId === seriesId) : undefined;
    const plan = nextDrawingVersion(
      existing ? { id: existing.id, version: existing.version, seriesId: existing.seriesId } : null,
    );
    const drawingId = Crypto.randomUUID();
    const nextSeriesId = plan.seriesId ?? drawingId;
    const storagePath = drawingStoragePath(workspace.organizationId, projectId, nextSeriesId, drawingId);
    const file = await fetch(asset.uri);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploadResult = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadResult.error) {
      setBusy(false);
      Alert.alert("アップロードできません", uploadResult.error.message);
      return;
    }
    if (plan.markPreviousLatestFalse && existing) {
      await supabase
        .from("documents")
        .update({ is_latest: false })
        .eq("id", existing.id)
        .eq("organization_id", workspace.organizationId);
    }
    const { error } = await supabase.from("documents").insert({
      id: drawingId,
      organization_id: workspace.organizationId,
      project_id: projectId,
      title: title.trim() || existing?.title || "図面",
      kind: "other",
      category: "drawing",
      drawing_kind: drawingKind,
      version: plan.version,
      is_latest: true,
      series_id: nextSeriesId,
      supersedes_id: plan.supersedesId,
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_name: asset.name ?? "drawing.pdf",
      file_size_bytes: info.size,
      created_by: workspace.userId,
    });
    setBusy(false);
    if (error) {
      Alert.alert("登録できません", error.message);
      return;
    }
    setTitle("");
    setSeriesId("");
    void load();
    navigation.navigate("DrawingViewer", {
      drawingId,
      projectId,
      title: title.trim() || existing?.title || "図面",
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.heading}>{projectName} の図面</Text>
      {writable ? (
        <View style={styles.card}>
          <Text style={styles.label}>新規 / 版上げ</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="図面名" />
          <Text style={styles.label}>分類</Text>
          <ChipRow
            value={drawingKind}
            onChange={setDrawingKind}
            options={Object.entries(DRAWING_KIND_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Text style={styles.label}>既存図面の新バージョン</Text>
          <ChipRow
            value={seriesId || "new"}
            onChange={(value) => setSeriesId(value === "new" ? "" : value)}
            options={[
              { value: "new", label: "新規" },
              ...rows.map((row) => ({ value: row.seriesId, label: `${row.title} v${row.version}` })),
            ]}
          />
          <Pressable style={styles.primary} onPress={() => void upload()} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "登録中…" : "PDFを登録"}</Text>
          </Pressable>
        </View>
      ) : null}
      {rows.map((row) => (
        <Pressable
          key={row.id}
          style={styles.item}
          onPress={() =>
            navigation.navigate("DrawingViewer", {
              drawingId: row.id,
              projectId: row.projectId,
              title: row.title,
            })
          }
        >
          <Text style={styles.itemTitle}>{row.title}</Text>
          <Text style={styles.meta}>
            {DRAWING_KIND_LABELS[row.drawingKind ?? ""] ?? "図面"} / v{row.version} / 最新
          </Text>
        </Pressable>
      ))}
      {rows.length === 0 && !loading ? <Text style={styles.muted}>PDF図面はまだありません。</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 16,
  },
  label: { marginTop: 10, marginBottom: 8, fontWeight: "700", color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  primary: {
    marginTop: 16,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
    minHeight: 72,
    justifyContent: "center",
  },
  itemTitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  meta: { marginTop: 4, color: colors.muted, fontSize: 14 },
  muted: { color: colors.muted, marginTop: 12 },
});
