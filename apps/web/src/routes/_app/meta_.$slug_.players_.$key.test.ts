import type { MetaRunRound } from "@openrift/shared/types/api/meta";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { metaEvent, metaPhase, metaRow } from "@/test/meta-event-fixtures";

import { Route } from "./meta_.$slug_.players_.$key";

type LoaderFn = (ctx: {
  context: {
    queryClient: { query: (options: { queryKey: readonly unknown[] }) => Promise<unknown> };
  };
  params: { slug: string; key: string };
}) => Promise<unknown>;

const SLUG = "summoner-skirmish";

const ROUND: MetaRunRound = {
  phaseOrder: 1,
  roundNumber: 1,
  isCut: false,
  tableNumber: 1,
  outcome: "win",
  gamesWon: 2,
  gamesLost: 0,
  opponentId: "p-2",
};

function runLoader(
  overrides: { meta?: boolean; rounds?: MetaRunRound[]; missing?: boolean } = {},
): Promise<unknown> {
  const query = vi.fn((options: { queryKey: readonly unknown[] }) => {
    if (options.queryKey[0] === "feature-flags") {
      return Promise.resolve({ meta: overrides.meta ?? true });
    }
    if (options.queryKey[0] === "meta") {
      // The endpoint 404s a key no standings row answers to; the server
      // function turns that into this error.
      if (overrides.missing === true) {
        return Promise.reject(new Error("NOT_FOUND"));
      }
      return Promise.resolve({
        event: metaEvent(),
        phases: [metaPhase()],
        player: metaRow(),
        rounds: overrides.rounds ?? [ROUND],
        opponents: [],
        lastCutRound: null,
      });
    }
    return Promise.resolve({});
  });
  return (Route.options.loader as unknown as LoaderFn)({
    context: { queryClient: { query } },
    params: { slug: SLUG, key: "u1001" },
  });
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the loader resolved");
}

describe("/meta/$slug/players/$key loader", () => {
  it("returns the event and the player row the page renders from", async () => {
    const data = (await runLoader()) as { event: { slug: string }; player: { playerName: string } };

    expect(data.event.slug).toBe(SLUG);
    expect(data.player.playerName).toBe("Ana");
  });

  it("404s a key no standings row at this event answers to", async () => {
    expect(isNotFound(await thrownBy(runLoader({ missing: true })))).toBe(true);
  });

  it("404s a player whose event published standings but no rounds", async () => {
    expect(isNotFound(await thrownBy(runLoader({ rounds: [] })))).toBe(true);
  });

  it("sends the reader to the catalog while the archive is off", async () => {
    expect(isRedirect(await thrownBy(runLoader({ meta: false })))).toBe(true);
  });
});
