"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { ChatMember, ChatMessage } from "@/features/chat/queries";

type LocalStatus = "sent" | "sending" | "failed";

type Row = ChatMessage & { status: LocalStatus; clientId?: string };

export function ProjectChatPanel({
  projectId,
  organizationId,
  userId,
  initial,
  members,
}: {
  projectId: string;
  organizationId: string;
  userId: string;
  initial: ChatMessage[];
  members: ChatMember[];
}) {
  const [rows, setRows] = useState<Row[]>(initial.map((item) => ({ ...item, status: "sent" })));
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    try {
      const channel = supabase
        .channel(`chat:${projectId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
          (payload) => {
          const next = payload.new as {
            id: string;
            body: string;
            sender_profile_id: string;
            created_at: string;
            organization_id: string;
            photo_id: string | null;
            attachment_storage_path: string | null;
            attachment_file_name: string | null;
            mention_profile_ids: string[] | null;
            client_id: string | null;
          };
          if (next.organization_id !== organizationId) {
            return;
          }
          setRows((current) => {
            if (current.some((item) => item.id === next.id || (next.client_id && item.clientId === next.client_id))) {
              return current.map((item) =>
                item.id === next.id || item.clientId === next.client_id
                  ? { ...item, id: next.id, status: "sent" }
                  : item,
              );
            }
            return [
              {
                id: next.id,
                body: next.body,
                senderId: next.sender_profile_id,
                senderName: members.find((item) => item.profileId === next.sender_profile_id)?.displayName ?? "メンバー",
                createdAt: next.created_at,
                editedAt: null,
                photoId: next.photo_id,
                attachmentPath: next.attachment_storage_path,
                attachmentName: next.attachment_file_name,
                mentionIds: next.mention_profile_ids ?? [],
                status: "sent",
              },
              ...current,
            ];
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Realtimeに接続できません。一覧の再読み込みと送信は利用できます。");
        }
      });
      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      setError("Realtimeに接続できません。一覧の再読み込みと送信は利用できます。");
      return undefined;
    }
  }, [members, organizationId, projectId, supabase]);

  async function send(retry?: Row) {
    const text = retry?.body ?? body.trim();
    if (!text && !retry) {
      return;
    }
    const clientId = retry?.clientId ?? crypto.randomUUID();
    const optimistic: Row = retry
      ? { ...retry, status: "sending" }
      : {
          id: clientId,
          clientId,
          body: text,
          senderId: userId,
          senderName: "自分",
          createdAt: new Date().toISOString(),
          editedAt: null,
          photoId: null,
          attachmentPath: null,
          attachmentName: null,
          mentionIds: [],
          status: "sending",
        };
    setRows((current) => [optimistic, ...current.filter((item) => item.clientId !== clientId)]);
    setBody("");
    setError(null);
    const { error: insertError } = await supabase.from("project_messages").insert({
      id: clientId,
      client_id: clientId,
      organization_id: organizationId,
      project_id: projectId,
      sender_profile_id: userId,
      body: text,
    });
    if (insertError && insertError.code !== "23505") {
      setError(insertError.message);
      setRows((current) =>
        current.map((item) => (item.clientId === clientId ? { ...item, status: "failed" } : item)),
      );
      return;
    }
    await fetch("/api/chat/mentions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, body: text }),
    }).catch(() => undefined);
    setRows((current) =>
      current.map((item) => (item.clientId === clientId ? { ...item, status: "sent" } : item)),
    );
  }

  async function loadOlder() {
    const oldest = rows[rows.length - 1];
    if (!oldest) {
      return;
    }
    setLoadingMore(true);
    const { data } = await supabase
      .from("project_messages")
      .select("id, body, sender_profile_id, created_at, edited_at, photo_id, attachment_storage_path, attachment_file_name, mention_profile_ids")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .lt("created_at", oldest.createdAt)
      .order("created_at", { ascending: false })
      .limit(30);
    const extra = ((data as {
      id: string;
      body: string;
      sender_profile_id: string;
      created_at: string;
      edited_at: string | null;
      photo_id: string | null;
      attachment_storage_path: string | null;
      attachment_file_name: string | null;
      mention_profile_ids: string[] | null;
    }[] | null) ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      senderId: row.sender_profile_id,
      senderName: members.find((item) => item.profileId === row.sender_profile_id)?.displayName ?? "メンバー",
      createdAt: row.created_at,
      editedAt: row.edited_at,
      photoId: row.photo_id,
      attachmentPath: row.attachment_storage_path,
      attachmentName: row.attachment_file_name,
      mentionIds: row.mention_profile_ids ?? [],
      status: "sent" as const,
    }));
    setRows((current) => [...current, ...extra.filter((item) => !current.some((row) => row.id === item.id))]);
    setLoadingMore(false);
  }

  async function attach(kind: "file" | "photo", fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    const id = crypto.randomUUID();
    const path = `${organizationId}/projects/${projectId}/chat/${id}/${file.name.replace(/[^\w.\-]/g, "_")}`;
    const upload = await supabase.storage.from("org-files").upload(path, file, { upsert: false });
    if (upload.error) {
      setError(upload.error.message);
      return;
    }
    const isPhoto = file.type.startsWith("image/");
    const { error: insertError } = await supabase.from("project_messages").insert({
      id,
      client_id: id,
      organization_id: organizationId,
      project_id: projectId,
      sender_profile_id: userId,
      body: kind === "photo" || isPhoto ? "写真を共有しました" : file.name,
      attachment_storage_path: path,
      attachment_file_name: file.name,
      attachment_mime_type: file.type || null,
    });
    if (insertError) {
      setError(insertError.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">@名前 でメンションできます。この現場のメンバーだけが読めます。</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="メッセージ（@山田 など）"
          className="min-h-20 rounded-xl border border-zinc-200 px-4 py-3"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-2xl bg-zinc-900 px-4 py-2 text-white" onClick={() => void send()}>
            送信
          </button>
          <label className="rounded-2xl bg-white px-4 py-2 ring-1 ring-zinc-200">
            添付
            <input type="file" className="hidden" onChange={(event) => void attach("file", event.target.files)} />
          </label>
          <label className="rounded-2xl bg-white px-4 py-2 ring-1 ring-zinc-200">
            写真
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void attach("photo", event.target.files)}
            />
          </label>
        </div>
        <p className="text-xs text-zinc-500">メンバー: {members.map((item) => `@${item.displayName}`).join(" ")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <p className="text-sm text-zinc-500">
              {row.senderName} / {new Date(row.createdAt).toLocaleString("ja-JP")}
              {row.status !== "sent" ? ` / ${row.status === "sending" ? "送信中" : "失敗"}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
            {row.attachmentName ? <p className="mt-1 text-sm text-zinc-500">添付 {row.attachmentName}</p> : null}
            {row.photoId ? (
              <a className="mt-1 inline-flex text-sm underline" href={`/photos/${row.photoId}`}>
                写真を見る
              </a>
            ) : null}
            {row.status === "failed" ? (
              <button type="button" className="mt-2 text-sm underline" onClick={() => void send(row)}>
                再送
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" className="text-sm underline" disabled={loadingMore} onClick={() => void loadOlder()}>
        {loadingMore ? "読み込み中…" : "以前のメッセージ"}
      </button>
    </div>
  );
}
