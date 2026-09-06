import "server-only";

import { parseMentions } from "@kensapo/domain";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyWorkspaceMembers } from "@/lib/notifications";
import type { Workspace } from "@/lib/session";

export type ChatMember = { profileId: string; displayName: string };

export type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  editedAt: string | null;
  photoId: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  mentionIds: string[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listProjectChatMembers(projectId: string): Promise<ChatMember[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("project_members")
    .select("memberships(profile_id, profiles!profile_id(display_name))")
    .eq("project_id", projectId)
    .eq("status", "active")
    .is("deleted_at", null);
  return ((data as {
    memberships:
      | { profile_id: string; profiles: { display_name: string } | { display_name: string }[] | null }
      | { profile_id: string; profiles: { display_name: string } | { display_name: string }[] | null }[]
      | null;
  }[] | null) ?? [])
    .map((row) => {
      const membership = one(row.memberships);
      return {
        profileId: membership?.profile_id ?? "",
        displayName: one(membership?.profiles)?.display_name ?? "メンバー",
      };
    })
    .filter((item) => item.profileId);
}

export async function listProjectMessages(projectId: string, before?: string): Promise<ChatMessage[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("project_messages")
    .select("id, body, sender_profile_id, created_at, edited_at, photo_id, attachment_storage_path, attachment_file_name, mention_profile_ids, profiles:sender_profile_id(display_name)")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (before) {
    query = query.lt("created_at", before);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return ((data as {
    id: string;
    body: string;
    sender_profile_id: string;
    created_at: string;
    edited_at: string | null;
    photo_id: string | null;
    attachment_storage_path: string | null;
    attachment_file_name: string | null;
    mention_profile_ids: string[] | null;
    profiles: { display_name: string } | { display_name: string }[] | null;
  }[] | null) ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    senderId: row.sender_profile_id,
    senderName: one(row.profiles)?.display_name ?? "メンバー",
    createdAt: row.created_at,
    editedAt: row.edited_at,
    photoId: row.photo_id,
    attachmentPath: row.attachment_storage_path,
    attachmentName: row.attachment_file_name,
    mentionIds: row.mention_profile_ids ?? [],
  }));
}

export async function notifyChatMentions(
  workspace: Workspace,
  projectId: string,
  body: string,
): Promise<void> {
  const members = await listProjectChatMembers(projectId);
  const ids = parseMentions(body, members).filter((id) => id !== workspace.userId);
  if (ids.length === 0) {
    return;
  }
  await notifyWorkspaceMembers(workspace, {
    projectId,
    kind: "confirm_request",
    title: "チャットでメンションされました",
    body,
    href: `/projects/${projectId}?tab=chat`,
    profileIds: ids,
  });
}
