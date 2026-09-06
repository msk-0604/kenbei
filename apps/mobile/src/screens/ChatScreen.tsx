import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { colors } from "../theme";
import { notifyOrgMembers } from "../lib/notify-client";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { ProjectsStackParamList } from "../navigation";

type Row = {
  id: string;
  body: string;
  sender: string;
  createdAt: string;
  status: "sent" | "sending" | "failed";
};

export function ChatScreen() {
  const { workspace } = useSession();
  const route = useRoute<RouteProp<ProjectsStackParamList, "ProjectChat">>();
  const [rows, setRows] = useState<Row[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (before?: string) => {
    if (!workspace?.organizationId) {
      return;
    }
    let query = supabase
      .from("project_messages")
      .select("id, body, created_at, sender_profile_id, profiles:sender_profile_id(display_name)")
      .eq("project_id", route.params.projectId)
      .eq("organization_id", workspace.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (before) {
      query = query.lt("created_at", before);
    }
    const { data } = await query;
    const mapped = ((data as {
      id: string;
      body: string;
      created_at: string;
      profiles: { display_name: string } | { display_name: string }[] | null;
    }[] | null) ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      sender: Array.isArray(row.profiles) ? row.profiles[0]?.display_name ?? "メンバー" : row.profiles?.display_name ?? "メンバー",
      status: "sent" as const,
    }));
    setRows((current) => (before ? [...current, ...mapped] : mapped));
  }, [route.params.projectId, workspace]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!workspace?.organizationId) {
      return;
    }
    try {
      const channel = supabase
        .channel(`mchat:${route.params.projectId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${route.params.projectId}` },
          (payload) => {
            const next = payload.new as { id: string; body: string; created_at: string; organization_id: string };
            if (next.organization_id !== workspace.organizationId) {
              return;
            }
            setRows((current) => {
              if (current.some((item) => item.id === next.id)) {
                return current;
              }
              return [{ id: next.id, body: next.body, createdAt: next.created_at, sender: "メンバー", status: "sent" }, ...current];
            });
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setError("Realtimeに接続できません。一覧と再送は使えます。");
          }
        });
      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      return undefined;
    }
  }, [route.params.projectId, workspace]);

  async function send(retry?: Row) {
    if (!workspace?.organizationId) {
      return;
    }
    const text = retry?.body ?? body.trim();
    if (!text) {
      return;
    }
    const id = retry?.id ?? crypto.randomUUID();
    setRows((current) => [{ id, body: text, createdAt: new Date().toISOString(), sender: "自分", status: "sending" }, ...current.filter((item) => item.id !== id)]);
    setBody("");
    const { error: insertError } = await supabase.from("project_messages").insert({
      organization_id: workspace.organizationId,
      project_id: route.params.projectId,
      sender_profile_id: workspace.userId,
      body: text,
      client_id: id,
    });
    if (insertError) {
      setError(insertError.message);
      setRows((current) => current.map((item) => (item.id === id ? { ...item, status: "failed" } : item)));
      return;
    }
    if (text.includes("@")) {
      await notifyOrgMembers({
        organizationId: workspace.organizationId,
        projectId: route.params.projectId,
        kind: "confirm_request",
        title: "チャットでメンションされました",
        body: text,
        href: `/projects/${route.params.projectId}?tab=chat`,
        permissionAudience: "project.update",
      });
    }
    void load();
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          const last = rows[rows.length - 1];
          if (last) {
            void load(last.createdAt);
          }
        }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.meta}>
              {item.sender} / {item.status === "failed" ? "失敗" : item.status === "sending" ? "送信中" : item.createdAt}
            </Text>
            <Text style={styles.body}>{item.body}</Text>
            {item.status === "failed" ? (
              <Pressable onPress={() => void send(item)}>
                <Text style={styles.retry}>再送</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="@名前 でメンション" />
        <Pressable style={styles.send} onPress={() => void send()}>
          <Text style={styles.sendText}>送信</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  error: { color: colors.danger, padding: 12 },
  card: { backgroundColor: colors.card, marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 14 },
  meta: { color: colors.muted, fontSize: 12 },
  body: { marginTop: 4, fontSize: 16, color: colors.ink },
  retry: { marginTop: 8, fontWeight: "700" },
  composer: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderColor: colors.line },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12 },
  send: { minWidth: 72, borderRadius: 12, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "700" },
});
