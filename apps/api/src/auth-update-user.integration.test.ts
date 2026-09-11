import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuth } from "./auth.js";
import { createDb } from "./db/connect.js";
import { createEmailSender } from "./email.js";

const USER_ID = "a0000000-0200-4000-a000-000000000001";

const url = process.env.INTEGRATION_DB_URL;
const conn = url ? createDb(url) : null;

describe.skipIf(!conn)("updateUser profile fields (integration)", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { db, dialect } = conn!;
  const config = {
    isDev: true,
    corsOrigin: undefined,
    auth: { secret: "test-secret", adminEmail: undefined, google: undefined, discord: undefined },
    smtp: { configured: false },
  } as never as Parameters<typeof createAuth>[0]["config"];
  const auth = createAuth({
    config,
    db,
    dialect,
    sendEmail: createEmailSender(config.smtp, true),
  });
  let headers: Headers;

  beforeAll(async () => {
    const created = await auth.api.createApiKey({
      body: { name: "profile-fields", userId: USER_ID },
    });
    headers = new Headers({ "x-api-key": created.key });
  });

  afterAll(async () => {
    await db
      .updateTable("users")
      .set({ bio: null, profileShowRiotId: false })
      .where("id", "=", USER_ID)
      .execute();
    await db.destroy();
  });

  it("saves a bio on its own without touching the name", async () => {
    await auth.api.updateUser({ body: { bio: "  Fury and\nChaos player.  " }, headers });
    const row = await db
      .selectFrom("users")
      .select(["name", "bio"])
      .where("id", "=", USER_ID)
      .executeTakeFirstOrThrow();
    expect(row.bio).toBe("Fury and Chaos player.");
    expect(row.name).not.toBeNull();
  });

  it("saves a visibility toggle on its own", async () => {
    await auth.api.updateUser({ body: { profileShowRiotId: true }, headers });
    const row = await db
      .selectFrom("users")
      .select("profileShowRiotId")
      .where("id", "=", USER_ID)
      .executeTakeFirstOrThrow();
    expect(row.profileShowRiotId).toBe(true);
  });

  it("rejects a bio over the cap with its own error code", async () => {
    await expect(
      auth.api.updateUser({ body: { bio: "x".repeat(201) }, headers }),
    ).rejects.toMatchObject({ body: { code: "INVALID_BIO" } });
  });
});
