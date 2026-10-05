import { describe, expect, it } from "vitest";

import {
  canManageMember,
  createRoleRank,
  GROUP_ADMIN_ROLES,
  isGroupAdminRole,
} from "./friend-group-roles.js";

describe("createRoleRank", () => {
  it("ranks roles by position, lowest first", () => {
    const rank = createRoleRank(["member", "admin", "owner"]);
    expect(rank).toEqual({ member: 0, admin: 1, owner: 2 });
  });

  it("returns an empty map for no roles", () => {
    expect(createRoleRank([])).toEqual({});
  });
});

describe("isGroupAdminRole", () => {
  it("accepts admin and owner only", () => {
    expect(GROUP_ADMIN_ROLES).toEqual(["admin", "owner"]);
    expect(isGroupAdminRole("admin")).toBe(true);
    expect(isGroupAdminRole("owner")).toBe(true);
    expect(isGroupAdminRole("member")).toBe(false);
    expect(isGroupAdminRole(null)).toBe(false);
    expect(isGroupAdminRole(undefined)).toBe(false);
  });
});

describe("canManageMember", () => {
  it("lets the owner manage admins and members but never the owner", () => {
    expect(canManageMember("owner", "admin")).toBe(true);
    expect(canManageMember("owner", "member")).toBe(true);
    expect(canManageMember("owner", "owner")).toBe(false);
  });

  it("lets an admin manage members only", () => {
    expect(canManageMember("admin", "member")).toBe(true);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("admin", "owner")).toBe(false);
  });

  it("denies members and non-members", () => {
    expect(canManageMember("member", "member")).toBe(false);
    expect(canManageMember(null, "member")).toBe(false);
  });
});
