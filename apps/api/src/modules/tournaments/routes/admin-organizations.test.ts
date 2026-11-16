import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminOrganizationsRouter } from "./admin-organizations.js";

const organizations = {
  listAll: vi.fn(),
  getById: vi.fn(),
  getBySlug: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
};
const users = { getById: vi.fn() };

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const ORG_ID = "019d4999-4219-72f6-b7bb-64004e1b1bff";
const now = new Date("2026-03-17T00:00:00.000Z");
const org = {
  id: ORG_ID,
  slug: "piltover-league",
  name: "Piltover League",
  description: null,
  createdAt: now,
  updatedAt: now,
};

const violation = (constraint: string) =>
  Object.assign(new Error("duplicate key"), { code: "23505", constraint_name: constraint });

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { organizations, users } as never);
  await next();
});
registerRouterForTest(app, adminOrganizationsRouter);

function send(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /organizations", () => {
  it("answers 409 when a concurrent create takes the slug after the pre-check", async () => {
    organizations.getBySlug.mockResolvedValue(undefined);
    users.getById.mockResolvedValue({ id: USER_ID });
    organizations.create.mockRejectedValue(violation("organizations_slug_key"));

    const res = await send("POST", "/api/admin/v1/organizations", {
      slug: "piltover-league",
      name: "Piltover League",
      ownerUserId: USER_ID,
    });

    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.message).toBe('Organization "piltover-league" already exists');
  });

  it("does not map a unique violation on another constraint", async () => {
    organizations.getBySlug.mockResolvedValue(undefined);
    users.getById.mockResolvedValue({ id: USER_ID });
    organizations.create.mockRejectedValue(violation("organization_members_pkey"));

    const res = await send("POST", "/api/admin/v1/organizations", {
      slug: "piltover-league",
      name: "Piltover League",
      ownerUserId: USER_ID,
    });

    expect(res.status).toBe(500);
  });
});

describe("PATCH /organizations/:id", () => {
  it("answers 409 when a concurrent write takes the new slug after the pre-check", async () => {
    organizations.getById.mockResolvedValue(org);
    organizations.getBySlug.mockResolvedValue(undefined);
    organizations.update.mockRejectedValue(violation("organizations_slug_key"));

    const res = await send("PATCH", `/api/admin/v1/organizations/${ORG_ID}`, {
      slug: "zaun-circuit",
    });

    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.message).toBe('Organization "zaun-circuit" already exists');
  });
});
