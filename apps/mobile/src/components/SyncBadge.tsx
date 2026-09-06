import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import type { QueueStatus } from "../lib/photo-queue-logic";

export function syncLabel(status: QueueStatus): string {
  if (status === "synced") {
    return "同期済み";
  }
  if (status === "uploading") {
    return "アップロード中";
  }
  if (status === "failed") {
    return "失敗";
  }
  return "待機中";
}

export function SyncBadge({
  status,
  progress,
  onRetry,
}: {
  status: QueueStatus;
  progress?: number;
  onRetry?: () => void;
}) {
  const tone =
    status === "failed" ? colors.danger : status === "synced" ? colors.ink : colors.warn;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: tone }]}>
        {syncLabel(status)}
        {status === "uploading" && progress != null ? ` ${progress}%` : ""}
      </Text>
      {status === "failed" && onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} style={styles.retry}>
          <Text style={styles.retryText}>再試行</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  label: { fontSize: 13, fontWeight: "700" },
  retry: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.ink,
    justifyContent: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
