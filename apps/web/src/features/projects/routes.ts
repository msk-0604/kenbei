/** Dedicated creation URL. Empty `/projects` reuses Today’s empty copy and can fail to show the form. */
export const CREATE_PROJECT_PATH = "/projects/new";

/** After create, send first-time users to Today — not the tabbed project cockpit. */
export const PROJECT_CREATED_PATH = "/?created=project";

export function emptyWorkspaceCreateProjectHref(canCreateProject: boolean): string | null {
  if (!canCreateProject) {
    return null;
  }
  return CREATE_PROJECT_PATH;
}
