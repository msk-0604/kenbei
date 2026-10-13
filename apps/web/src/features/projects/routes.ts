/** 現場の登録画面（kenbei-alpha と同じ /sites/new。登録したあとそのまま作業工程を作る） */
export const CREATE_PROJECT_PATH = "/sites/new";

export function emptyWorkspaceCreateProjectHref(canCreateProject: boolean): string | null {
  if (!canCreateProject) {
    return null;
  }
  return CREATE_PROJECT_PATH;
}
