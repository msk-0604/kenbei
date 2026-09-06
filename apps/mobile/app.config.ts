import type { ExpoConfig } from "expo/config";

const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? "https://app.kenbei.jp";

const config: ExpoConfig = {
  name: "KENBEI",
  slug: "kenbei",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "kenbei",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.kenbei.app",
    buildNumber: "1",
    associatedDomains: ["applinks:app.kenbei.jp"],
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
      NSCameraUsageDescription: "現場写真を撮影するためにカメラを使います。",
      NSPhotoLibraryUsageDescription: "現場写真を登録するためにフォトライブラリへアクセスします。",
      NSPhotoLibraryAddUsageDescription: "黒板付き写真を保存するためにフォトライブラリへ書き込みます。",
    },
  },
  android: {
    package: "com.kenbei.app",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#0F172A",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: ["CAMERA", "READ_MEDIA_IMAGES", "POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "app.kenbei.jp", pathPrefix: "/join" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission: "現場写真を登録するためにフォトライブラリへアクセスします。",
        cameraPermission: "現場写真を撮影するためにカメラを使います。",
      },
    ],
    [
      "expo-notifications",
      {
        color: "#0F172A",
      },
    ],
    "expo-document-picker",
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    appUrl,
  },
};

export default config;
