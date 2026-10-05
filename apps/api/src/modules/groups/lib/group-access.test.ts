import type { FriendGroupRole } from "@openrift/shared/types/api/friend-group";
import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { GroupMember } from "../repositories/friend-groups-shared.js";
import {
  hasRole,
  loadGroupBySlug,
  loadGroupForMember,
  requireRole,
  ROLE_RANK,
} from "./group-access.js";

function membership(role: FriendGroupRole): GroupMember {
  return {
    groupId: "g1",
    userId: "u1",
    role,
    joinedAt: new Date(),
  };
}

describe("hasRole", () => {
  it("orders the hierarchy owner > admin > member", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.member);
  });

  it("passes when the role meets the minimum", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("owner", "admin")).toBe(true);
    expect(hasRole("owner", "owner")).toBe(true);
    expect(hasRole("member", "member")).toBe(true);
  });

  it("fails when the role is below the minimum", () => {
    expect(hasRole("member", "admin")).toBe(false);
    expect(hasRole("admin", "owner")).toBe(false);
  });
});

describe("requireRole", () => {
  it("passes an admin for an admin minimum", () => {
    expect(() => requireRole(membership("admin"), "admin")).not.toThrow();
  });

  it("rejects a member for an admin minimum with 403", () => {
    try {
      requireRole(membership("member"), "admin");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(403);
    }
  });

  it("rejects a member for every elevated minimum", () => {
    expect(() => requireRole(membership("member"), "admin")).toThrow(AppError);
    expect(() => requireRole(membership("member"), "owner")).toThrow(AppError);
  });

  it("accepts every role for a member minimum", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      expect(() => requireRole(membership(role), "member")).not.toThrow();
    }
  });

  it("rejects a non-member with 403", () => {
    expect(() => requireRole(undefined, "member")).toThrow(AppError);
  });
});

function reposWith(group: unknown, member: GroupMember | undefined): Repos {
  return {
    friendGroups: {
      getBySlugOrPrevious: vi.fn(async () => group),
      getMembership: vi.fn(async () => member),
    },
  } as unknown as Repos;
}

describe("loadGroupBySlug", () => {
  it("returns the group", async () => {
    await expect(loadGroupBySlug(reposWith({ id: "g1" }, undefined), "s")).resolves.toEqual({
      id: "g1",
    });
  });

  it("throws 404 when the slug matches no group", async () => {
    await expect(loadGroupBySlug(reposWith(undefined, undefined), "s")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("loadGroupForMember", () => {
  it("returns the group with the viewer's membership", async () => {
    const member = membership("member");
    await expect(loadGroupForMember(reposWith({ id: "g1" }, member), "s", "u1")).resolves.toEqual({
      group: { id: "g1" },
      membership: member,
    });
  });

  it("throws 404 for a non-member", async () => {
    await expect(
      loadGroupForMember(reposWith({ id: "g1" }, undefined), "s", "u1"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
