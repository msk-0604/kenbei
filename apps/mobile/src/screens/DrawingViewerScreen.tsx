import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { colors } from "../theme";
import { PHOTO_BUCKET } from "../lib/photo-settings";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { ProjectsStackParamList } from "../navigation";

export function DrawingViewerScreen() {
  const { workspace } = useSession();
  const route = useRoute<RouteProp<ProjectsStackParamList, "DrawingViewer">>();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!workspace?.organizationId) {
      return;
    }
    const { data } = await supabase
      .from("documents")
      .select("storage_path, organization_id, title")
      .eq("id", route.params.drawingId)
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    const row = data as { storage_path: string; organization_id: string; title: string } | null;
    if (!row) {
      setError("図面を開けません。");
      return;
    }
    const signed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, 60 * 10);
    if (!signed.data?.signedUrl) {
      setError("ダウンロードできません。");
      return;
    }
    setUrl(signed.data.signedUrl);
  }, [route.params.drawingId, workspace]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!url) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs" type="module"></script>
<style>body{margin:0;background:#111;color:#fff;font-family:sans-serif}canvas{width:100%;display:block}</style>
</head>
<body>
<canvas id="c"></canvas>
<script type="module">
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
const pageNum = ${page};
const pdf = await pdfjsLib.getDocument(${JSON.stringify(url)}).promise;
const p = await pdf.getPage(Math.min(pageNum, pdf.numPages));
const viewport = p.getViewport({ scale: 1.4 });
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.height = viewport.height;
canvas.width = viewport.width;
await p.render({ canvasContext: ctx, viewport }).promise;
window.ReactNativeWebView?.postMessage(String(pdf.numPages));
</script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{route.params.title}</Text>
      <WebView originWhitelist={["*"]} source={{ html }} style={styles.web} />
      <View style={styles.pager}>
        <Pressable onPress={() => setPage((n) => Math.max(1, n - 1))}>
          <Text style={styles.pagerText}>前のページ</Text>
        </Pressable>
        <Text style={styles.pagerText}>{page}</Text>
        <Pressable onPress={() => setPage((n) => n + 1)}>
          <Text style={styles.pagerText}>次のページ</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, padding: 16 },
  title: { padding: 12, fontWeight: "700", color: colors.ink },
  web: { flex: 1, backgroundColor: "#111" },
  pager: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  pagerText: { fontWeight: "700", color: colors.ink },
});
