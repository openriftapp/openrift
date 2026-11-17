import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { createProductFromList } from "./products.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const LIST_ID = "a0000000-0001-4000-a000-000000000002";

describe("createProductFromList", () => {
  it("answers a slug taken after the pre-check with a 409", async () => {
    const repos = {
      products: {
        slugTaken: vi.fn(async () => false),
        create: vi.fn(async () => {
          throw Object.assign(new Error("duplicate key"), {
            code: "23505",
            constraint_name: "uq_products_slug",
          });
        }),
      },
      lists: {
        getByIdForUser: vi.fn(async () => ({ id: LIST_ID, kind: "printing" })),
        entriesWithDetails: vi.fn(async () => [
          { kind: "printing", printingId: "p-1", quantity: 1 },
        ]),
      },
    } as unknown as Repos;
    const transact = ((fn: (trx: Repos) => unknown) => fn(repos)) as unknown as Transact;

    await expect(
      createProductFromList(repos, transact, USER_ID, {
        slug: "origins-booster",
        name: "Origins Booster",
        listId: LIST_ID,
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Slug "origins-booster" already in use' });
  });
});
