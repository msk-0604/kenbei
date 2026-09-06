import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "./src/lib/session";
import { PhotoQueueProvider } from "./src/lib/photo-queue-context";
import { LoginScreen, SignupScreen } from "./src/screens/AuthScreens";
import { TodayScreen } from "./src/screens/TodayScreen";
import { ProjectsScreen, ProjectDetailScreen } from "./src/screens/ProjectsScreen";
import { PhotosScreen } from "./src/screens/PhotosScreen";
import { PhotoDetailScreen } from "./src/screens/PhotoDetailScreen";
import { ConfirmScreen } from "./src/screens/ConfirmScreen";
import { AccountScreen } from "./src/screens/AccountScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { TaskFormScreen } from "./src/screens/TaskFormScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { ReportFormScreen } from "./src/screens/ReportFormScreen";
import { DrawingsScreen } from "./src/screens/DrawingsScreen";
import { DrawingViewerScreen } from "./src/screens/DrawingViewerScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { GanttScreen } from "./src/screens/GanttScreen";
import { navigateFromPush, navigationRef } from "./src/lib/navigation-ref";
import { extraFromPushData, parseKenbeiRoute } from "./src/lib/deep-link";
import { registerPushToken } from "./src/lib/push-token";
import { brand, colors } from "./src/theme";
import type {
  AccountStackParamList,
  MainTabParamList,
  PhotosStackParamList,
  ProjectsStackParamList,
} from "./src/navigation";

const Tab = createBottomTabNavigator<MainTabParamList>();
const ProjectsStack = createNativeStackNavigator<ProjectsStackParamList>();
const PhotosStack = createNativeStackNavigator<PhotosStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();

function ProjectsNavigator() {
  return (
    <ProjectsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
      }}
    >
      <ProjectsStack.Screen name="ProjectsList" component={ProjectsScreen} options={{ title: "現場" }} />
      <ProjectsStack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: "現場詳細" }} />
      <ProjectsStack.Screen name="DrawingsList" component={DrawingsScreen} options={{ title: "図面" }} />
      <ProjectsStack.Screen name="DrawingViewer" component={DrawingViewerScreen} options={{ title: "図面" }} />
      <ProjectsStack.Screen name="ProjectChat" component={ChatScreen} options={{ title: "チャット" }} />
      <ProjectsStack.Screen name="ProjectGantt" component={GanttScreen} options={{ title: "工程" }} />
    </ProjectsStack.Navigator>
  );
}

function PhotosNavigator() {
  return (
    <PhotosStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
      }}
    >
      <PhotosStack.Screen name="PhotosList" component={PhotosScreen} options={{ title: "写真" }} />
      <PhotosStack.Screen name="PhotoDetail" component={PhotoDetailScreen} options={{ title: "写真詳細" }} />
    </PhotosStack.Navigator>
  );
}

function AccountNavigator() {
  return (
    <AccountStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
      }}
    >
      <AccountStack.Screen name="AccountHome" component={AccountScreen} options={{ title: "自分" }} />
      <AccountStack.Screen name="TasksList" component={TasksScreen} options={{ title: "タスク" }} />
      <AccountStack.Screen name="TaskForm" component={TaskFormScreen} options={{ title: "タスク" }} />
      <AccountStack.Screen name="ReportsList" component={ReportsScreen} options={{ title: "日報" }} />
      <AccountStack.Screen name="ReportForm" component={ReportFormScreen} options={{ title: "日報" }} />
    </AccountStack.Navigator>
  );
}

function PushAndLinkBridge() {
  const { workspace } = useSession();

  useEffect(() => {
    if (!workspace?.organizationId) {
      return;
    }
    void registerPushToken(workspace).catch(() => undefined);
  }, [workspace]);

  useEffect(() => {
    if (!workspace?.organizationId) {
      return;
    }
    const openUrl = (url: string) => {
      const parsed = parseKenbeiRoute(url);
      if (parsed) {
        navigateFromPush(workspace, url, {});
      }
    };
    const sub = Linking.addEventListener("url", (event) => openUrl(event.url));
    void Linking.getInitialURL().then((url) => {
      if (url) {
        openUrl(url);
      }
    });
    const received = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const extra = extraFromPushData(data);
      navigateFromPush(workspace, extra.href, data);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const extra = extraFromPushData(data);
      navigateFromPush(workspace, extra.href, data);
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [workspace]);

  return null;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { minHeight: 60, paddingBottom: 6, paddingTop: 6, backgroundColor: colors.card },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ title: "Today", headerTitle: brand.name }} />
      <Tab.Screen name="Projects" component={ProjectsNavigator} options={{ title: "現場", headerShown: false }} />
      <Tab.Screen name="Photos" component={PhotosNavigator} options={{ title: "写真", headerShown: false }} />
      <Tab.Screen name="Confirm" component={ConfirmScreen} options={{ title: "確認" }} />
      <Tab.Screen name="Account" component={AccountNavigator} options={{ title: "自分", headerShown: false }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { loading, session } = useSession();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  if (!session) {
    return authMode === "login" ? (
      <LoginScreen onGoSignup={() => setAuthMode("signup")} />
    ) : (
      <SignupScreen onGoLogin={() => setAuthMode("login")} />
    );
  }

  return (
    <PhotoQueueProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: colors.paper,
            card: colors.paper,
            text: colors.ink,
            border: colors.line,
            primary: colors.ink,
          },
        }}
      >
        <>
          <MainTabs />
          <PushAndLinkBridge />
        </>
      </NavigationContainer>
    </PhotoQueueProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
});
