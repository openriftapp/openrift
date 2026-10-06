import { describe, expect, it } from "vitest";

import type { ArtTrack } from "./accept";
import type { PrintingLockDeps } from "./printing-lock";
import {
  PRINTING_ATTEMPTS,
  createPrintingLock,
  createPrintingReader,
  unanimousPick,
} from "./printing-lock";
import { printingCard } from "./test-images";

const ART = "art-lux";

function lockedTrack(key: string): ArtTrack {
  return {
    artKey: ART,
    key,
    label: key,
    firstSeen: 0,
    sightings: 2,
    runLength: 2,
    runWeight: 2,
    lockedThisRun: true,
    lastFrame: 1,
    lockedAt: 0.1,
    lockedFrame: 1,
    framesToLock: 1,
    printingResolved: false,
    runStartFrame: 0,
    runStartSeconds: 0,
    maxRunLength: 2,
  };
}

function printingDeps(
  renders: Record<string, number>,
  overrides: Partial<PrintingLockDeps> = {},
): PrintingLockDeps {
  const images = new Map(Object.entries(renders).map(([key, stamp]) => [key, printingCard(stamp)]));
  return {
    bank: { keys: Object.keys(renders), vectors: new Float32Array(0) },
    artKeyOf: () => ART,
    labelOf: (key) => key,
    identityOf: () => ({ markers: "" }),
    fetchReference: (key) => Promise.resolve(images.get(key) ?? null),
    ...overrides,
  };
}

describe("createPrintingLock", () => {
  it("abstains for an artwork with a single printing", async () => {
    const lock = createPrintingLock(printingDeps({ "p-en": 1 }));

    expect(await lock.disambiguate(lockedTrack("p-en"), printingCard(1), 0)).toBeUndefined();
  });

  it("holds the pick back until a second frame agrees with it", async () => {
    const lock = createPrintingLock(printingDeps({ "p-en": 1, "p-sc": 9 }));
    const track = lockedTrack("p-en");

    const readout = await lock.disambiguate(track, printingCard(1), 0);

    expect(readout?.scores.map((score) => score.key)).toEqual(["p-en", "p-sc"]);
    expect(track.printingResolved).toBe(false);
  });

  it("applies the pick on the second agreeing frame", async () => {
    const lock = createPrintingLock(printingDeps({ "p-en": 1, "p-sc": 9 }));
    const track = lockedTrack("p-sc");

    await lock.disambiguate(track, printingCard(1), 0);
    const readout = await lock.disambiguate(track, printingCard(1), 0);

    expect(readout?.via).toBe("name");
    expect(track).toMatchObject({ key: "p-en", label: "p-en", printingResolved: true });
  });

  it("follows the card in front of the camera, not the shortlist order", async () => {
    const lock = createPrintingLock(printingDeps({ "p-en": 1, "p-sc": 9 }));
    const track = lockedTrack("p-en");

    await lock.disambiguate(track, printingCard(9), 0);
    await lock.disambiguate(track, printingCard(9), 0);

    expect(track).toMatchObject({ key: "p-sc", printingResolved: true });
  });

  it("refuses to name a residual class whose members disagree on their label", async () => {
    const labels: Record<string, string> = {
      "p-en": "Lux [OGN EN]",
      "p-dup": "Lux [UNL EN]",
      "p-sc": "Lux [OGN SC]",
    };
    const lock = createPrintingLock(
      printingDeps({ "p-en": 1, "p-dup": 1, "p-sc": 9 }, { labelOf: (key) => labels[key] ?? key }),
    );
    const track = lockedTrack("p-en");

    await lock.disambiguate(track, printingCard(1), 0);
    await lock.disambiguate(track, printingCard(1), 0);

    expect(track.printingResolved).toBe(false);
  });

  it("names a residual class whose members are the same printing twice", async () => {
    const labels: Record<string, string> = {
      "p-en": "Lux [OGN EN]",
      "p-dup": "Lux [OGN EN]",
      "p-sc": "Lux [OGN SC]",
    };
    const lock = createPrintingLock(
      printingDeps({ "p-en": 1, "p-dup": 1, "p-sc": 9 }, { labelOf: (key) => labels[key] ?? key }),
    );
    const track = lockedTrack("p-sc");

    await lock.disambiguate(track, printingCard(1), 0);
    await lock.disambiguate(track, printingCard(1), 0);

    expect(track).toMatchObject({ label: "Lux [OGN EN]", printingResolved: true });
  });

  it("settles on the plain printing when a promo shares its render", async () => {
    const lock = createPrintingLock(
      printingDeps(
        { "p-en": 1, "p-promo": 1, "p-sc": 9 },
        {
          labelOf: (key) => (key === "p-sc" ? "Lux [OGN SC]" : "Lux [OGN EN]"),
          identityOf: (key) => ({ markers: key === "p-promo" ? "promo" : "" }),
        },
      ),
    );
    const track = lockedTrack("p-promo");

    await lock.disambiguate(track, printingCard(1), 0);
    await lock.disambiguate(track, printingCard(1), 0);

    expect(track).toMatchObject({ key: "p-en", printingResolved: true });
  });

  it("fetches the printings' references at the same time", async () => {
    let inFlight = 0;
    let mostInFlight = 0;
    const lock = createPrintingLock(
      printingDeps(
        { "p-en": 1, "p-fr": 5, "p-sc": 9 },
        {
          fetchReference: async (key) => {
            inFlight++;
            mostInFlight = Math.max(mostInFlight, inFlight);
            await Promise.resolve();
            inFlight--;
            return printingCard(key === "p-en" ? 1 : 5);
          },
        },
      ),
    );

    await lock.disambiguate(lockedTrack("p-en"), printingCard(1), 0);

    expect(mostInFlight).toBe(3);
  });

  it("refuses attempts past the cap until the track locks again", () => {
    const lock = createPrintingLock(printingDeps({ "p-en": 1, "p-sc": 9 }));
    const track = lockedTrack("p-en");

    const taken = Array.from({ length: PRINTING_ATTEMPTS + 1 }, () => lock.takeAttempt(track));
    expect(taken.filter(Boolean)).toHaveLength(PRINTING_ATTEMPTS);
    expect(taken.at(-1)).toBe(false);
    lock.restart(track);
    expect(lock.takeAttempt(track)).toBe(true);
  });
});

describe("createPrintingReader", () => {
  it("picks the printing in a single read, without waiting for a second frame", async () => {
    const read = createPrintingReader(printingDeps({ "p-en": 1, "p-sc": 9 }));

    const result = await read(ART, "p-sc", printingCard(1), 0);

    expect(result?.picked?.key).toBe("p-en");
  });

  it("reads nothing for an artwork with a single printing", async () => {
    const read = createPrintingReader(printingDeps({ "p-en": 1 }));

    expect(await read(ART, "p-en", printingCard(1), 0)).toBeUndefined();
  });
});

describe("unanimousPick", () => {
  const lookups = { labelOf: (key: string) => key.split("#")[0] ?? key };

  it("accepts a pick whose look-alikes share its label and markers", () => {
    const picked = {
      key: "p-en#1",
      margin: 0.2,
      indistinguishable: ["p-en#2"],
      via: "name" as const,
    };
    expect(unanimousPick(picked, { ...lookups, identityOf: () => ({ markers: "" }) })).toBe(true);
  });

  it("rejects a pick whose look-alike carries another marker", () => {
    const picked = {
      key: "p-en#1",
      margin: 0.2,
      indistinguishable: ["p-en#2"],
      via: "name" as const,
    };
    const identityOf = (key: string) => ({ markers: key.endsWith("2") ? "promo" : "" });
    expect(unanimousPick(picked, { ...lookups, identityOf })).toBe(false);
  });
});
