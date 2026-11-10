import { afterAll, describe, expect, it } from "vitest";

import { PRINTING_1 } from "../../../test/fixtures/constants.js";
import { createTestContext, req, seedTestUser } from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";

const USER_ID = crypto.randomUUID();

const ctx = createTestContext(USER_ID);

if (ctx) {
  await seedTestUser(ctx.db, { id: USER_ID });
}

describe.skipIf(!ctx)("overlay routes (integration)", () => {
  const { app, db } = ctx!;

  afterAll(async () => {
    await db.deleteFrom("users").where("id", "=", USER_ID).execute();
  });

  it("keeps both of a push and a hide sent at the same time", async () => {
    await app.fetch(req("GET", "/overlay/me"));

    for (let attempt = 0; attempt < 5; attempt++) {
      await app.fetch(req("POST", "/overlay/me/clear"));
      const responses = await Promise.all([
        app.fetch(req("POST", "/overlay/me/push", { printingId: PRINTING_1.id })),
        app.fetch(req("POST", "/overlay/me/hidden", { hidden: true })),
      ]);
      expect(responses.map((res) => res.status)).toEqual([200, 200]);

      const channel = (await readJson(await app.fetch(req("GET", "/overlay/me")))) as {
        payload: { printingId: string | null; hidden: boolean };
      };
      expect(channel.payload).toMatchObject({ printingId: PRINTING_1.id, hidden: true });
    }
  });
});
