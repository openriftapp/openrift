import { adminsRepo } from "../apps/api/src/modules/users/repositories/admins.js";
import { usersRepo } from "../apps/api/src/modules/users/repositories/users.js";
import { parseScriptArgs, runWithDb } from "./env.js";

const {
  positionals: [email = ""],
} = parseScriptArgs({}, "Usage: bun run scripts/make-admin.ts <email>", 1);

await runWithDb(async (db) => {
  const users = usersRepo(db);
  const found = await users.getIdByEmail(email);
  const user = found && (await users.getById(found.id));
  if (!user) {
    throw new Error(`No user found with email: ${email}`);
  }

  await adminsRepo(db).autoPromote(user.id);
  console.log(`Admin granted to ${user.email} (${user.id})`);
});
