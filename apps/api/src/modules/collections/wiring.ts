import type { OwnedCopyRow } from "@openrift/shared/list-rule-eval";
import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
import { tagCategoryRepo } from "../catalog/repositories/tag-categories.js";
import { collectionDeckbuildingPrefsRepo } from "./repositories/collection-deckbuilding-prefs.js";
import { collectionEventsRepo } from "./repositories/collection-events.js";
import { collectionSidebarPrefsRepo } from "./repositories/collection-sidebar-prefs.js";
import { collectionsRepo } from "./repositories/collections.js";
import { copiesRepo } from "./repositories/copies.js";
import { customTagsRepo } from "./repositories/custom-tags.js";

export interface CollectionsRepos {
  collectionEvents: ReturnType<typeof collectionEventsRepo>;
  collections: ReturnType<typeof collectionsRepo>;
  collectionDeckbuildingPrefs: ReturnType<typeof collectionDeckbuildingPrefsRepo>;
  collectionSidebarPrefs: ReturnType<typeof collectionSidebarPrefsRepo>;
  copies: ReturnType<typeof copiesRepo>;
  customTagCategories: ReturnType<typeof tagCategoryRepo>;
  customTags: ReturnType<typeof customTagsRepo>;
}

export function createCollectionsRepos(db: Kysely<Database>): CollectionsRepos {
  return {
    collectionEvents: collectionEventsRepo(db),
    collections: collectionsRepo(db),
    collectionDeckbuildingPrefs: collectionDeckbuildingPrefsRepo(db),
    collectionSidebarPrefs: collectionSidebarPrefsRepo(db),
    copies: copiesRepo(db),
    customTagCategories: tagCategoryRepo(db, {
      table: "customTagCategories",
      tagTable: "customTags",
    }),
    customTags: customTagsRepo(db),
  };
}

export function createOwnedCopiesReader(
  db: Kysely<Database>,
): (ownerId: string, printingIds?: readonly string[]) => Promise<OwnedCopyRow[]> {
  return (ownerId, printingIds) => copiesRepo(db).ownedRowsForUser(ownerId, printingIds);
}
