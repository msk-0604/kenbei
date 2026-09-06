import { describe, expect, it } from "vitest";
import {
  SYSTEM_ROLE_PERMISSIONS,
  hasPermission,
  isProjectScopedRole,
} from "./index";

describe("RBAC matrix", () => {
  it("does not grant finance.read to partner or worker", () => {
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.partner, "finance.read")).toBe(false);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.worker, "finance.read")).toBe(false);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.guest, "finance.read")).toBe(false);
  });

  it("does not grant project.read_all to scoped field roles", () => {
    expect(isProjectScopedRole("worker")).toBe(true);
    expect(isProjectScopedRole("partner")).toBe(true);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.worker, "project.read_all")).toBe(false);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.partner, "project.read_all")).toBe(false);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.owner, "project.read_all")).toBe(true);
  });

  it("keeps org.security on owner only among system roles", () => {
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.owner, "org.security")).toBe(true);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.executive, "org.security")).toBe(false);
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.manager, "org.security")).toBe(false);
  });
});
