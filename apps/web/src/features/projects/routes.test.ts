import { describe, expect, it } from "vitest";
import { workspaceWriteBlockMessage, workspaceWritesAllowed } from "@kensapo/domain";
import { isAnonymousPublicPath } from "../../lib/public-path";
import { CREATE_PROJECT_PATH, PROJECT_CREATED_PATH, emptyWorkspaceCreateProjectHref } from "./routes";

describe("empty-workspace project creation path", () => {
  it("sends 0-project Trial users to the creation form, not Today", () => {
    expect(workspaceWritesAllowed("trial_active")).toBe(true);
    expect(emptyWorkspaceCreateProjectHref(true)).toBe(CREATE_PROJECT_PATH);
    expect(CREATE_PROJECT_PATH).toBe("/projects/new");
    expect(CREATE_PROJECT_PATH).not.toBe("/");
    expect(CREATE_PROJECT_PATH).not.toBe("/projects");
    expect(isAnonymousPublicPath(CREATE_PROJECT_PATH)).toBe(false);
  });

  it("does not invent a create href without project.create", () => {
    expect(emptyWorkspaceCreateProjectHref(false)).toBeNull();
  });

  it("sends new projects to Today, not the project cockpit", () => {
    expect(PROJECT_CREATED_PATH).toBe("/?created=project");
    expect(PROJECT_CREATED_PATH.startsWith("/?")).toBe(true);
    expect(PROJECT_CREATED_PATH).not.toMatch(/^\/projects\//);
  });

  it("keeps expired-trial write block", () => {
    expect(workspaceWritesAllowed("trial_expired")).toBe(false);
    expect(workspaceWriteBlockMessage("trial_expired")).toBeTruthy();
    expect(workspaceWriteBlockMessage("trial_active")).toBeNull();
  });
});
