import {
  createNavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";
import { extraFromPushData, parseKenbeiRoute, type KenbeiRoute } from "./deep-link";
import type { MainTabParamList } from "../navigation";
import type { Workspace } from "./session";

export const navigationRef = createNavigationContainerRef<MainTabParamList>();

export function navigateKenbeiRoute(
  route: KenbeiRoute,
  workspace: Workspace,
  extra?: Record<string, string | undefined>,
): void {
  if (extra?.organizationId && extra.organizationId !== workspace.organizationId) {
    return;
  }
  if (extra?.profileId && extra.profileId !== workspace.userId) {
    return;
  }
  if (!navigationRef.isReady()) {
    return;
  }
  if (route.type === "confirm") {
    navigationRef.navigate("Confirm");
    return;
  }
  if (route.type === "project") {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: "Projects",
        params: {
          screen: "ProjectDetail",
          params: { projectId: route.projectId, name: "現場" },
        },
      }),
    );
    return;
  }
  if (route.type === "task") {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: "Account",
        params: {
          screen: "TaskForm",
          params: { taskId: route.taskId, projectId: route.projectId },
        },
      }),
    );
    return;
  }
  if (route.type === "report") {
    if (!route.projectId) {
      navigationRef.dispatch(CommonActions.navigate({ name: "Account", params: { screen: "ReportsList" } }));
      return;
    }
    navigationRef.dispatch(
      CommonActions.navigate({
        name: "Account",
        params: {
          screen: "ReportForm",
          params: {
            reportId: route.reportId,
            projectId: route.projectId,
            projectName: "現場",
          },
        },
      }),
    );
    return;
  }
  navigationRef.dispatch(
    CommonActions.navigate({
      name: "Projects",
      params: {
        screen: "DrawingViewer",
        params: {
          drawingId: route.drawingId,
          projectId: route.projectId,
          title: "図面",
        },
      },
    }),
  );
}

export function navigateFromPush(
  workspace: Workspace,
  href: string | null | undefined,
  data: Record<string, unknown> | undefined,
): void {
  const extra = extraFromPushData(data);
  const parsed = parseKenbeiRoute(href ?? extra.href, extra);
  if (!parsed) {
    navigationRef.navigate("Confirm");
    return;
  }
  navigateKenbeiRoute(parsed, workspace, extra);
}
