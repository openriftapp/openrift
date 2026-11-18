import type { QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { isSignedOutViewerQuery } from "./viewer-change";

const USER = "viewer-user-id";

// Keys whose data is the same for every viewer, by leading segments; an account switch keeps them.
const SHARED_PREFIXES: readonly (readonly string[])[] = [
  ["catalog"],
  ["custom-tags"],
  ["prices"],
  ["card-detail"],
  ["sets"],
  ["errata"],
  ["promos"],
  ["products"],
  ["priceHistory"],
  ["marketplaceLinks"],
  ["meta"],
  ["rules"],
  ["scan"],
  ["feature-flags"],
  ["site-settings"],
  ["init"],
  ["collections", "share"],
  ["decks", "share"],
  ["lists", "share"],
  ["board-states", "share"],
  ["board-states", "featured"],
  ["tier-lists", "share"],
  ["overlay", "state"],
  ["pod-tournaments", "report"],
];

const keyModules = import.meta.glob<Record<string, unknown>>(
  ["./query-keys.ts", "../features/*/lib/*-query-keys.ts"],
  { eager: true },
);

function parameterNames(fn: (...args: unknown[]) => unknown): string[] {
  const source = fn.toString();
  const list =
    /^[^(]*\((?<params>[^)]*)\)/u.exec(source)?.groups?.params ?? source.split("=>")[0] ?? "";
  return list
    .split(",")
    .map((param) =>
      param
        .replace(/[=:].*$/su, "")
        .replace(/^\.\.\./u, "")
        .trim(),
    )
    .filter(Boolean);
}

function anyArgument(name: string): unknown {
  const target = () => {};
  const proxy: unknown = new Proxy(target, {
    get: (_target, property) => (property === Symbol.toPrimitive ? () => `${name}-arg` : proxy),
    apply: () => proxy,
  });
  return proxy;
}

function collectKeys(value: unknown, keys: QueryKey[]): void {
  if (Array.isArray(value)) {
    // A list of keys (an invalidation scope) holds arrays; a key starts with a string.
    if (value.length > 0 && value.every((entry) => Array.isArray(entry))) {
      for (const entry of value) {
        collectKeys(entry, keys);
      }
      return;
    }
    keys.push(value);
    return;
  }
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    const args = parameterNames(fn).map((name) =>
      /userid/iu.test(name) ? USER : anyArgument(name),
    );
    collectKeys(fn(...args), keys);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectKeys(nested, keys);
    }
  }
}

function allQueryKeys(): QueryKey[] {
  const keys: QueryKey[] = [];
  for (const exports of Object.values(keyModules)) {
    collectKeys(exports, keys);
  }
  return keys;
}

describe("viewer change coverage", () => {
  it("finds the key factories", () => {
    expect(allQueryKeys().length).toBeGreaterThan(50);
  });

  it("clears or deliberately keeps every query key on an account switch", () => {
    const uncovered = new Set<string>();
    for (const key of allQueryKeys()) {
      const shared = SHARED_PREFIXES.some((prefix) =>
        prefix.every((segment, index) => key[index] === segment),
      );
      // A key under the user id is the viewer's own; its TanStack DB store slot is freed by the collection.
      const ownSlot = key[1] === USER;
      if (key[0] !== "server-cache" && !shared && !ownSlot && !isSignedOutViewerQuery(key, USER)) {
        uncovered.add(key.slice(0, 2).map(String).join("/"));
      }
    }
    expect([...uncovered]).toEqual([]);
  });
});
