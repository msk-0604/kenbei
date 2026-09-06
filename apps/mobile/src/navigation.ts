import type { NavigatorScreenParams } from "@react-navigation/native";

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string; name: string };
  DrawingsList: { projectId: string; projectName: string };
  DrawingViewer: { drawingId: string; projectId?: string; title: string };
  ProjectChat: { projectId: string; projectName: string };
  ProjectGantt: { projectId: string; projectName: string };
};

export type PhotosStackParamList = {
  PhotosList: { projectId?: string; projectName?: string } | undefined;
  PhotoDetail: { photoId: string; source: "local" | "remote" };
};

export type AccountStackParamList = {
  AccountHome: undefined;
  TasksList: { projectId?: string; projectName?: string } | undefined;
  TaskForm: { taskId?: string; projectId?: string; projectName?: string };
  ReportsList: { projectId?: string; projectName?: string } | undefined;
  ReportForm: { reportId?: string; projectId: string; projectName: string; workOn?: string };
};

export type MainTabParamList = {
  Today: undefined;
  Projects: NavigatorScreenParams<ProjectsStackParamList>;
  Photos: NavigatorScreenParams<PhotosStackParamList>;
  Confirm: undefined;
  Account: NavigatorScreenParams<AccountStackParamList>;
};
