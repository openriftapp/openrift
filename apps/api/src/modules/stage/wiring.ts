import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
import { boardStatesRepo } from "./repositories/board-states.js";
import { overlayChannelsRepo } from "./repositories/overlay-channels.js";
import { stagePresetsRepo } from "./repositories/stage-presets.js";
import { tierListsRepo } from "./repositories/tier-lists.js";

export interface StageRepos {
  boardStates: ReturnType<typeof boardStatesRepo>;
  overlayChannels: ReturnType<typeof overlayChannelsRepo>;
  stagePresets: ReturnType<typeof stagePresetsRepo>;
  tierLists: ReturnType<typeof tierListsRepo>;
}

export function createStageRepos(db: Kysely<Database>): StageRepos {
  return {
    boardStates: boardStatesRepo(db),
    overlayChannels: overlayChannelsRepo(db),
    stagePresets: stagePresetsRepo(db),
    tierLists: tierListsRepo(db),
  };
}
