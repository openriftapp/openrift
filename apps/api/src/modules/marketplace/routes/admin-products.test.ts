import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import type { Variables } from "../../../types.js";
import { adminProductsRouter } from "./admin-products";

const mockProducts = {
  getById: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  slugTaken: vi.fn(),
};
const mockSets = { getRef: vi.fn() };
const mockAdminEvents = { insert: vi.fn() };

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const PRODUCT_ID = "a0000000-0001-4000-a000-000000000099";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", {
    products: mockProducts,
    sets: mockSets,
    adminEvents: mockAdminEvents,
  } as never);
  await next();
});
registerRouterForTest(app, adminProductsRouter);

const existing = {
  id: PRODUCT_ID,
  slug: "origins-booster",
  name: "Origins Booster",
  description: null,
  setId: null,
};

describe("admin products audit events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockProducts.getById.mockResolvedValue(existing);
    mockProducts.slugTaken.mockResolvedValue(false);
  });

  it("records the deleted product's name and key fields", async () => {
    mockProducts.remove.mockResolvedValue(true);

    const res = await app.request(`/api/admin/v1/products/${PRODUCT_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      action: "product.delete",
      entityType: "product",
      entityId: PRODUCT_ID,
      entityLabel: "Origins Booster",
      oldValues: {
        slug: "origins-booster",
        name: "Origins Booster",
        setId: null,
        description: null,
      },
    });
  });

  it("records old and new values of the changed fields on update", async () => {
    const res = await app.request(`/api/admin/v1/products/${PRODUCT_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Origins Booster Box" }),
    });

    expect(res.status).toBe(204);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.update",
        oldValues: { name: "Origins Booster" },
        newValues: { name: "Origins Booster Box" },
      }),
    );
  });
});
