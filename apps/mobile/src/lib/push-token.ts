import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { getDeviceId } from "./device-id";
import { supabase } from "./supabase";
import type { Workspace } from "./session";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync("default", {
    name: "KENBEI",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function registerPushToken(workspace: Workspace): Promise<void> {
  if (!workspace.organizationId || !Device.isDevice) {
    return;
  }
  await ensureAndroidChannel();
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") {
    return;
  }
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResponse.data;
    if (!token) {
      return;
    }
    const deviceId = await getDeviceId();
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    await supabase.from("push_tokens").upsert(
      {
        organization_id: workspace.organizationId,
        profile_id: workspace.userId,
        device_id: deviceId,
        token,
        platform,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,profile_id,device_id" },
    );
  } catch {
    return;
  }
}

export async function deactivatePushToken(workspace: Workspace | null): Promise<void> {
  if (!workspace?.organizationId) {
    return;
  }
  const deviceId = await getDeviceId();
  await supabase
    .from("push_tokens")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("organization_id", workspace.organizationId)
    .eq("profile_id", workspace.userId)
    .eq("device_id", deviceId);
}
