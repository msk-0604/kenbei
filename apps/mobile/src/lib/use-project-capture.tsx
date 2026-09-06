import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import {
  enqueueCapturedPhotos,
  isCaptureFailure,
  pickFromLibrary,
  takePhoto,
  type CapturedAsset,
} from "../lib/photo-capture";
import { useSession } from "../lib/session";

export function useProjectCapture() {
  const { workspace } = useSession();
  const [preview, setPreview] = useState<CapturedAsset | null>(null);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);

  async function saveAssets(projectId: string, projectName: string, assets: CapturedAsset[]) {
    if (!workspace?.organizationId) {
      setMessage("会社がありません。");
      return 0;
    }
    setBusy(true);
    const result = await enqueueCapturedPhotos({
      assets,
      organizationId: workspace.organizationId,
      projectId,
      projectName,
      userId: workspace.userId,
      displayName: workspace.displayName,
    });
    setBusy(false);
    if (result.saved > 0) {
      setMessage(`${result.saved}枚を端末に保存しました。通信できれば自動で同期します。`);
    }
    if (result.errors[0]) {
      setMessage(result.errors[0]);
    }
    return result.saved;
  }

  async function startCamera(projectId: string, projectName: string, continueBurst = true) {
    setProject({ id: projectId, name: projectName });
    setBurst(continueBurst);
    setMessage(null);
    const shot = await takePhoto();
    if (isCaptureFailure(shot)) {
      if (shot.reason !== "canceled") {
        setMessage(shot.message);
      }
      return;
    }
    setPreview(shot);
  }

  async function startLibrary(projectId: string, projectName: string) {
    setProject({ id: projectId, name: projectName });
    setPreview(null);
    setMessage(null);
    const picked = await pickFromLibrary();
    if (isCaptureFailure(picked)) {
      if (picked.reason !== "canceled") {
        setMessage(picked.message);
      }
      return;
    }
    await saveAssets(projectId, projectName, picked);
  }

  async function confirmPreview() {
    if (!preview || !project) {
      return;
    }
    const asset = preview;
    setPreview(null);
    await saveAssets(project.id, project.name, [asset]);
    if (burst) {
      await startCamera(project.id, project.name, true);
    }
  }

  async function retake() {
    if (!project) {
      return;
    }
    setPreview(null);
    await startCamera(project.id, project.name, burst);
  }

  function CapturePreviewModal() {
    return (
      <Modal visible={preview != null} animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.modal}>
          {preview ? <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="contain" /> : null}
          <Text style={styles.hint}>コメントは後から付けられます。連続で撮ってください。</Text>
          <Pressable style={styles.primary} onPress={() => void confirmPreview()} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>使う</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => void retake()}>
            <Text style={styles.secondaryText}>再撮影</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => setPreview(null)}>
            <Text style={styles.linkText}>閉じる</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return { startCamera, startLibrary, message, setMessage, busy, CapturePreviewModal };
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#0F172A", padding: 20, justifyContent: "flex-end" },
  preview: { flex: 1, marginTop: 48, borderRadius: 12, backgroundColor: "#000" },
  hint: { color: "#CBD5E1", marginVertical: 12, fontSize: 14 },
  primary: {
    backgroundColor: "#fff",
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryText: { fontSize: 17, fontWeight: "700", color: colors.ink },
  secondary: {
    backgroundColor: "transparent",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  link: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  linkText: { color: "#94A3B8", fontSize: 15 },
});
