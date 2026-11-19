import type { Kysely } from "kysely";
import { sql } from "kysely";

// Keys minted before scopes existed act as their owner without limits. Owners with
// admin access keep that through the admin scope; everyone else gets write on every area.
const AREAS = { collection: ["read", "write"], lists: ["read", "write"], decks: ["read", "write"] };
const WITH_ADMIN = JSON.stringify({ ...AREAS, admin: ["access"] });
const WITHOUT_ADMIN = JSON.stringify(AREAS);

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE api_keys k
    SET permissions = CASE
      WHEN EXISTS (SELECT 1 FROM admins a WHERE a.user_id = k.reference_id)
        OR EXISTS (SELECT 1 FROM admin_grants g WHERE g.user_id = k.reference_id)
      THEN ${WITH_ADMIN}
      ELSE ${WITHOUT_ADMIN}
    END
    WHERE k.permissions IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE api_keys SET permissions = NULL
    WHERE permissions IN (${WITH_ADMIN}, ${WITHOUT_ADMIN})
  `.execute(db);
}
