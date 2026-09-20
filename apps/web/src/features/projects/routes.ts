/** Dedicated creation URL. Empty `/projects` reuses Today’s empty copy and can fail to show the form. */
export const CREATE_PROJECT_PATH = "/projects/new";

export function emptyWorkspaceCreateProjectHref(canCreateProject: boolean): string | null {
  if (!canCreateProject) {
    return null;
  }
  return CREATE_PROJECT_PATH;
}
