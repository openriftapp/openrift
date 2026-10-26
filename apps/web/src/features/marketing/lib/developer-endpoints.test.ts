import { cardsContract } from "@openrift/shared/contracts/cards";
import { catalogContract } from "@openrift/shared/contracts/catalog";
import { pricesContract } from "@openrift/shared/contracts/prices";
import { rulesContract } from "@openrift/shared/contracts/rules";
import { setsContract } from "@openrift/shared/contracts/sets";
import { describe, expect, it } from "vitest";

import { DEVELOPER_ENDPOINT_PATHS } from "./developer-endpoints";

interface ContractDef {
  route?: { path?: string };
  meta?: { developerApi?: boolean };
}

function developerPaths(contract: Record<string, unknown>): string[] {
  return Object.values(contract).flatMap((procedure) => {
    const def = (procedure as { "~orpc"?: ContractDef })["~orpc"];
    return def?.meta?.developerApi && def.route?.path ? [def.route.path] : [];
  });
}

describe("DEVELOPER_ENDPOINT_PATHS", () => {
  it("lists exactly the contracts flagged developerApi", () => {
    const flagged = [
      catalogContract,
      cardsContract,
      setsContract,
      pricesContract,
      rulesContract,
    ].flatMap((contract) => developerPaths(contract));
    expect([...DEVELOPER_ENDPOINT_PATHS].toSorted()).toEqual(flagged.toSorted());
  });
});
