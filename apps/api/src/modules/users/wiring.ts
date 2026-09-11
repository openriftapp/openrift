import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
import { adminGrantsRepo } from "./repositories/admin-grants.js";
import { adminsRepo } from "./repositories/admins.js";
import { featureFlagsRepo } from "./repositories/feature-flags.js";
import { userContactMethodsRepo } from "./repositories/user-contact-methods.js";
import { userFeatureFlagsRepo } from "./repositories/user-feature-flags.js";
import { userPreferencesRepo } from "./repositories/user-preferences.js";
import { userProfileRepo } from "./repositories/user-profile.js";
import { usersRepo } from "./repositories/users.js";

export interface UsersRepos {
  admins: ReturnType<typeof adminsRepo>;
  adminGrants: ReturnType<typeof adminGrantsRepo>;
  featureFlags: ReturnType<typeof featureFlagsRepo>;
  userContactMethods: ReturnType<typeof userContactMethodsRepo>;
  userFeatureFlags: ReturnType<typeof userFeatureFlagsRepo>;
  userPreferences: ReturnType<typeof userPreferencesRepo>;
  userProfile: ReturnType<typeof userProfileRepo>;
  users: ReturnType<typeof usersRepo>;
}

export function createUsersRepos(db: Kysely<Database>): UsersRepos {
  return {
    admins: adminsRepo(db),
    adminGrants: adminGrantsRepo(db),
    featureFlags: featureFlagsRepo(db),
    userContactMethods: userContactMethodsRepo(db),
    userFeatureFlags: userFeatureFlagsRepo(db),
    userPreferences: userPreferencesRepo(db),
    userProfile: userProfileRepo(db),
    users: usersRepo(db),
  };
}
