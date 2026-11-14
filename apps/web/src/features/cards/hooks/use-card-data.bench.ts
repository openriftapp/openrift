// Benchmark: current JS filter/sort path vs. TanStack DB query-builder path.
// Measures whether migrating /cards filter+sort logic onto TanStack DB
// introduces a perceptible regression for the filter-toggle workload
// (query-changing, data-stable — the worst case for live-query dataflow).

import { filterCards } from "@openrift/shared/filters";
import { sortCards } from "@openrift/shared/filters-sort";
import { testSearchContext } from "@openrift/shared/test-factories";
import type { Printing } from "@openrift/shared/types/catalog";
import type { CardFilters } from "@openrift/shared/types/search";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import {
  and,
  createCollection,
  gte,
  ilike,
  inArray,
  localOnlyCollectionOptions,
  lte,
  queryOnce,
} from "@tanstack/react-db";
import { test } from "vitest";

import { buildSyntheticPrintings } from "@/test/synthetic-catalog";

const printings = buildSyntheticPrintings();

function emptyFilters(): CardFilters {
  return { ...EMPTY_CARD_FILTERS };
}

const SCENARIOS = {
  noop: emptyFilters(),
  simple: {
    ...emptyFilters(),
    domains: ["chaos"],
    energy: { min: 2, max: 5 },
    rarities: ["common", "rare"],
  } as CardFilters,
  complex: {
    ...emptyFilters(),
    search: "hero",
    domains: ["chaos", "order"],
    energy: { min: 2, max: 6 },
    might: { min: 0, max: 5 },
    rarities: ["common", "rare", "legendary"],
    languages: ["EN"],
    types: ["unit"],
  } as CardFilters,
};

const printingsCollection = createCollection(
  localOnlyCollectionOptions<Printing>({
    getKey: (p) => p.printingId,
    initialData: printings,
  }),
);

function runTanstackQuery(filters: CardFilters) {
  return queryOnce({
    query: (q) => {
      let builder = q.from({ p: printingsCollection });
      if (filters.rarities.length > 0) {
        builder = builder.where(({ p }) => inArray(p.rarity, filters.rarities));
      }
      if (filters.domains.length > 0) {
        const [firstDomain] = filters.domains;
        if (firstDomain) {
          builder = builder.where(({ p }) => inArray(firstDomain, p.card.domains));
        }
      }
      if (filters.types.length > 0) {
        const [firstType] = filters.types;
        if (firstType) {
          builder = builder.where(({ p }) => inArray(firstType, p.card.types));
        }
      }
      if (filters.languages.length > 0) {
        builder = builder.where(({ p }) => inArray(p.language, filters.languages));
      }
      if (filters.energy.min !== null && filters.energy.max !== null) {
        builder = builder.where(({ p }) =>
          and(gte(p.card.energy, filters.energy.min), lte(p.card.energy, filters.energy.max)),
        );
      }
      if (filters.might.min !== null && filters.might.max !== null) {
        builder = builder.where(({ p }) =>
          and(gte(p.card.might, filters.might.min), lte(p.card.might, filters.might.max)),
        );
      }
      if (filters.search) {
        const pattern = `%${filters.search}%`;
        builder = builder.where(({ p }) => ilike(p.card.name, pattern));
      }
      return builder.orderBy(({ p }) => p.card.name);
    },
  });
}

test("filter+sort: current JS path", async ({ bench }) => {
  await bench.compare(
    bench("noop", () => {
      const f = filterCards(printings, SCENARIOS.noop, testSearchContext());
      sortCards(f, "name", { sortDir: "asc" });
    }),
    bench("simple", () => {
      const f = filterCards(printings, SCENARIOS.simple, testSearchContext());
      sortCards(f, "name", { sortDir: "asc" });
    }),
    bench("complex", () => {
      const f = filterCards(printings, SCENARIOS.complex, testSearchContext());
      sortCards(f, "name", { sortDir: "asc" });
    }),
  );
});

test("filter+sort: TanStack DB queryOnce path", async ({ bench }) => {
  await bench.compare(
    bench("noop", async () => {
      await runTanstackQuery(SCENARIOS.noop);
    }),
    bench("simple", async () => {
      await runTanstackQuery(SCENARIOS.simple);
    }),
    bench("complex", async () => {
      await runTanstackQuery(SCENARIOS.complex);
    }),
  );
});
