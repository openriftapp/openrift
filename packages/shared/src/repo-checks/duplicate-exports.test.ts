import { describe, expect, it } from "vitest";

import {
  collectExportNames,
  diffBaseline,
  findDuplicateNames,
  formatBaseline,
  nextBaseline,
  parseBaseline,
} from "./duplicate-exports.js";

function names(source: string): string[] {
  return [...collectExportNames("fixture.ts", source)].toSorted();
}

describe("collectExportNames", () => {
  it("collects every name of a variable statement, including destructured ones", () => {
    expect(
      names(`
        export const a = 1, b = 2;
        export const { c, d: renamed, ...rest } = source;
        export const [first, , third] = list;
      `),
    ).toEqual(["a", "b", "c", "first", "renamed", "rest", "third"]);
  });

  it("collects declarations of every kind", () => {
    expect(
      names(`
        export function fn() {}
        export async function asyncFn() {}
        export abstract class Shape {}
        export interface Props {}
        export type Alias = string;
        export enum Color { Red }
        export const enum Flag { On }
        export namespace Space {}
        export declare const declared: number;
        export declare function declaredFn(): void;
      `),
    ).toEqual([
      "Alias",
      "Color",
      "Flag",
      "Props",
      "Shape",
      "Space",
      "asyncFn",
      "declared",
      "declaredFn",
      "fn",
    ]);
  });

  it("collects local export lists under their exported name", () => {
    expect(
      names(`
        const x = 1;
        type A = string;
        export { x as y };
        export type { A };
        export { x as default };
      `),
    ).toEqual(["A", "y"]);
  });

  it("skips re-exports, default exports and unexported declarations", () => {
    expect(
      names(`
        export { a } from "./a.js";
        export type { B } from "./b.js";
        export * from "./c.js";
        export * as d from "./d.js";
        export default function named() {}
        export default class {}
        const local = 1;
        function helper() {}
      `),
    ).toEqual([]);
  });

  it("counts overloads and a value and type of one name once", () => {
    expect(
      names(`
        export function pick(a: string): string;
        export function pick(a: number): number;
        export function pick(a: unknown) { return a; }
        export const Mode = { on: "on" } as const;
        export type Mode = (typeof Mode)[keyof typeof Mode];
      `),
    ).toEqual(["Mode", "pick"]);
  });

  it("parses tsx", () => {
    expect([
      ...collectExportNames("fixture.tsx", "export function Card() { return <div />; }"),
    ]).toEqual(["Card"]);
  });
});

describe("findDuplicateNames", () => {
  it("keeps names defined in two or more files, sorted, with sorted files", () => {
    const result = findDuplicateNames(
      new Map([
        ["b.ts", ["shared", "onlyB"]],
        ["a.ts", ["shared", "zeta"]],
        ["c.ts", ["zeta"]],
      ]),
    );
    expect([...result]).toEqual([
      ["shared", ["a.ts", "b.ts"]],
      ["zeta", ["a.ts", "c.ts"]],
    ]);
  });

  it("returns nothing when every name is unique", () => {
    expect(
      findDuplicateNames(
        new Map([
          ["a.ts", ["one"]],
          ["b.ts", ["two"]],
        ]),
      ).size,
    ).toBe(0);
  });
});

describe("parseBaseline", () => {
  it("reads name and file count per line and skips blank lines", () => {
    expect([...parseBaseline("joinNames 2\n\nmakePrinting 3\n")]).toEqual([
      ["joinNames", 2],
      ["makePrinting", 3],
    ]);
  });

  it("reads an empty file as an empty baseline", () => {
    expect(parseBaseline("").size).toBe(0);
  });

  it.each(["joinNames", "joinNames two", "join Names 2"])("rejects %j", (line) => {
    expect(() => parseBaseline(line)).toThrow();
  });
});

describe("formatBaseline", () => {
  it("writes one sorted line per name and round-trips through parseBaseline", () => {
    const text = formatBaseline(
      new Map([
        ["zeta", 2],
        ["alpha", 3],
      ]),
    );
    expect(text).toBe("alpha 3\nzeta 2\n");
    expect(parseBaseline(text)).toEqual(
      new Map([
        ["alpha", 3],
        ["zeta", 2],
      ]),
    );
  });
});

describe("diffBaseline", () => {
  it("flags a new name and a baselined name that gained a file", () => {
    const current = new Map([
      ["kept", 2],
      ["third", 3],
      ["new", 2],
    ]);
    const baseline = new Map([
      ["kept", 2],
      ["third", 2],
    ]);
    expect(diffBaseline(current, baseline)).toEqual({ grown: ["new", "third"], shrunk: [] });
  });

  it("reports names that lost a file or are no longer duplicated", () => {
    const current = new Map([["fewer", 2]]);
    const baseline = new Map([
      ["fewer", 3],
      ["gone", 2],
    ]);
    expect(diffBaseline(current, baseline)).toEqual({ grown: [], shrunk: ["fewer", "gone"] });
  });

  it("is empty when the baseline matches", () => {
    const counts = new Map([["a", 2]]);
    expect(diffBaseline(counts, new Map(counts))).toEqual({ grown: [], shrunk: [] });
  });
});

describe("nextBaseline", () => {
  const current = new Map([
    ["fewer", 2],
    ["grew", 3],
    ["new", 2],
  ]);
  const baseline = new Map([
    ["fewer", 3],
    ["grew", 2],
    ["gone", 2],
  ]);

  it("only lowers counts and drops names without allowGrowth", () => {
    expect(nextBaseline(current, baseline, false)).toEqual(
      new Map([
        ["fewer", 2],
        ["grew", 2],
      ]),
    );
  });

  it("takes the current counts with allowGrowth", () => {
    expect(nextBaseline(current, baseline, true)).toEqual(current);
  });
});
