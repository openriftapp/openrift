import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it, vi } from "vitest";

import type { wellKnownRepo } from "../repositories/well-known.js";
import { validateWellKnownSlugs } from "./validate-well-known.js";

type WellKnownRepo = ReturnType<typeof wellKnownRepo>;

function repoReturning(override?: (slug: string) => boolean | undefined): WellKnownRepo {
  return {
    wellKnownStatus: vi.fn(async (_table: string, _pk: string, slugs: string[]) =>
      slugs.flatMap((slug) => {
        const isWellKnown = override ? override(slug) : true;
        return isWellKnown === undefined ? [] : [{ slug, isWellKnown }];
      }),
    ),
  } as unknown as WellKnownRepo;
}

describe("validateWellKnownSlugs", () => {
  it("passes when every well-known slug exists and is flagged", async () => {
    await expect(validateWellKnownSlugs(repoReturning())).resolves.toBeUndefined();
  });

  it("reports a missing slug", async () => {
    const missing = WellKnown.finish.FOIL;
    await expect(
      validateWellKnownSlugs(repoReturning((slug) => (slug === missing ? undefined : true))),
    ).rejects.toThrow(`WellKnown.finish.FOIL = "${missing}" not found in finishes`);
  });

  it("reports a slug that exists without the well-known flag", async () => {
    const unflagged = WellKnown.language.EN;
    await expect(
      validateWellKnownSlugs(repoReturning((slug) => slug !== unflagged)),
    ).rejects.toThrow(`exists in languages but is_well_known is false`);
  });
});
