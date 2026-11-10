import { createDb } from "../apps/api/src/db/connect.js";
import { marketplaceAdminRepo } from "../apps/api/src/modules/marketplace/repositories/marketplace-admin.js";
import { assertLocalDatabase, requireEnv } from "./env.js";

const databaseUrl = requireEnv("DATABASE_URL");
assertLocalDatabase(databaseUrl);
const { db } = createDb(databaseUrl);
const repo = marketplaceAdminRepo(db);

for (const marketplace of ["tcgplayer", "cardmarket"]) {
  const deleted = await repo.clearPriceData(marketplace);
  console.log(
    `${marketplace}: ${deleted.snapshots} snapshots, ${deleted.sources} sources, ${deleted.staging} staging`,
  );
}

await db.destroy();
console.log("Done — all price tables cleared.");
