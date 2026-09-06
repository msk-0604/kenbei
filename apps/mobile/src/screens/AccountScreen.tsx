import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { brand, colors } from "../theme";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { AccountStackParamList } from "../navigation";

function PlanLine() {
  const { workspace } = useSession();
  const [plan, setPlan] = useState("FREE");
  useEffect(() => {
    if (!workspace?.organizationId) {
      return;
    }
    void supabase
      .from("organization_billing")
      .select("plan_code, status")
      .eq("organization_id", workspace.organizationId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { plan_code: string; status: string } | null;
        if (row) {
          const label =
            row.plan_code === "free"
              ? "FREE"
              : row.plan_code === "business"
                ? "BUSINESS"
                : row.plan_code === "enterprise"
                  ? "ENTERPRISE"
                  : "STANDARD";
          setPlan(`${label} / ${row.status}`);
        }
      });
  }, [workspace?.organizationId]);
  return <Text style={styles.muted}>{plan}</Text>;
}

export function AccountScreen() {
  const { workspace, signOut, switchOrganization } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();

  if (!workspace) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>{brand.name}</Text>
      <Text style={styles.reading}>{brand.reading}</Text>

      <Text style={styles.label}>ユーザー</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{workspace.displayName}</Text>
        <Text style={styles.muted}>{workspace.email ?? "—"}</Text>
      </View>

      <Text style={styles.label}>会社</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{workspace.organizationName || "未所属"}</Text>
      <Text style={styles.muted}>{workspace.roleName || workspace.roleCode || "ロールなし"}</Text>
      <PlanLine />
      {workspace.organizations.length > 1
        ? workspace.organizations.map((item) => (
            <Pressable
              key={item.organizationId}
              onPress={() => void switchOrganization(item.organizationId)}
              style={styles.switchRow}
            >
              <Text style={item.organizationId === workspace.organizationId ? styles.switchOn : styles.muted}>
                {item.organizationName}
                {item.organizationId === workspace.organizationId ? "（選択中）" : ""}
              </Text>
            </Pressable>
          ))
        : null}
      </View>

      <Pressable style={styles.secondary} onPress={() => navigation.navigate("TasksList")}>
        <Text style={styles.secondaryText}>タスク</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => navigation.navigate("ReportsList")}>
        <Text style={styles.secondaryText}>日報</Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={() => void signOut()}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 24 },
  brand: { fontSize: 28, fontWeight: "700", color: colors.ink, letterSpacing: 1 },
  reading: { marginTop: 4, marginBottom: 28, color: colors.muted, fontSize: 14 },
  label: { marginBottom: 8, color: colors.muted, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 20,
    minHeight: 72,
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  muted: { marginTop: 4, color: colors.muted, fontSize: 14 },
  switchRow: { marginTop: 10, paddingVertical: 6 },
  switchOn: { marginTop: 4, color: colors.ink, fontSize: 14, fontWeight: "700" },
  secondary: {
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  secondaryText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  logout: {
    marginTop: 12,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  logoutText: { fontSize: 16, fontWeight: "600", color: colors.danger },
});
