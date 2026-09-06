import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ActionRow({
  onApprove,
  onReject,
  onDetail,
  approveLabel = "承認",
  rejectLabel = "差戻し",
}: {
  onApprove?: () => void;
  onReject?: () => void;
  onDetail?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  return (
    <View style={styles.actions}>
      {onApprove ? (
        <Pressable style={styles.primary} onPress={onApprove}>
          <Text style={styles.primaryText}>{approveLabel}</Text>
        </Pressable>
      ) : null}
      {onReject ? (
        <Pressable style={styles.secondary} onPress={onReject}>
          <Text style={styles.secondaryText}>{rejectLabel}</Text>
        </Pressable>
      ) : null}
      {onDetail ? (
        <Pressable style={styles.ghost} onPress={onDetail}>
          <Text style={styles.ghostText}>詳細を見る</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  labelOn: { color: "#fff" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  primary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.ink,
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: "center",
  },
  secondaryText: { color: colors.ink, fontWeight: "700" },
  ghost: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
  ghostText: { color: colors.muted, fontWeight: "600" },
});
