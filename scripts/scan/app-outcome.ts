import type { LoadedScanBank } from "../../apps/web/src/features/scan/lib/scan-bank.js";
import type { ScanPrintingIndex } from "../../apps/web/src/features/scan/lib/scan-resolve.js";
import {
  buildScanPrintingIndex,
  resolveLock,
} from "../../apps/web/src/features/scan/lib/scan-resolve.js";
import type {
  AppOutcome,
  AppScore,
  BenchLock,
  ClipTruth,
  ScoredLock,
} from "../../packages/shared/src/scan/bench-score.js";
import { scoreAppOutcomes } from "../../packages/shared/src/scan/bench-score.js";
import type { CardIdentity } from "./catalog";
import { argValue } from "./lib";
import { loadPrintings } from "./printings";

type Catalog = Map<string, CardIdentity>;

/** The app's card language setting from `--language`: EN by default, undefined for "any". */
export function languageSetting(): string | undefined {
  const value = argValue("--language") ?? "EN";
  return value === "any" ? undefined : value;
}

export function appPrintingIndex(catalog: Catalog, refresh = false): ScanPrintingIndex {
  return buildScanPrintingIndex(loadPrintings(refresh), {
    artKeys: new Map([...catalog.values()].map((identity) => [identity.key, identity.artKey])),
  } as LoadedScanBank);
}

function appOutcome(
  lock: BenchLock,
  name: string,
  index: ScanPrintingIndex,
  language?: string,
): AppOutcome {
  const resolution = resolveLock(
    { key: lock.key, artKey: lock.artKey, resolved: lock.printingResolved },
    index,
    language,
  );
  if (resolution.kind === "unknown") {
    return { kind: "unknown" };
  }
  const printings = resolution.kind === "auto" ? [resolution.printing] : resolution.candidates;
  return {
    kind: resolution.kind,
    printings: printings.map((printing) => ({
      name,
      artKey: lock.artKey,
      publicCode: printing.publicCode,
      language: printing.language,
      markers: printing.markers
        .map((marker) => marker.slug)
        .toSorted()
        .join("+"),
    })),
  };
}

export function scoreAppLocks(
  truth: ClipTruth,
  locks: readonly ScoredLock[],
  catalog: Catalog,
  index: ScanPrintingIndex,
  language?: string,
): AppScore {
  return scoreAppOutcomes(
    truth,
    locks.map((lock) => {
      const name = catalog.get(lock.key)?.name ?? lock.label;
      return { lock, name, outcome: appOutcome(lock, name, index, language) };
    }),
  );
}
