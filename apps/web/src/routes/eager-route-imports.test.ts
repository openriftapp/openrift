import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "..");
const ROUTES = path.join(SRC, "routes");
const COUNTRY = path.join(SRC, "lib/country.ts");
const EXTENSIONS = [".ts", ".tsx"];

function eagerRouteFiles(): string[] {
  return readdirSync(ROUTES, { recursive: true, encoding: "utf-8" })
    .filter(
      (file) =>
        /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file) && !file.endsWith(".lazy.tsx"),
    )
    .map((file) => path.join(ROUTES, file));
}

function resolveSpecifier(from: string, specifier: string): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(from), specifier);
  } else {
    return undefined;
  }
  const stem = base.replace(/\.js$/u, "");
  const candidates = [
    ...EXTENSIONS.map((extension) => stem + extension),
    ...EXTENSIONS.map((extension) => path.join(stem, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function staticImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf-8"), ts.ScriptTarget.Latest);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword
    ) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier !== undefined
    ) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    }
  }
  return specifiers.flatMap((specifier) => resolveSpecifier(file, specifier) ?? []);
}

function chainsToCountry(entries: readonly string[]): string[][] {
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const entry of entries) {
    parent.set(entry, null);
    queue.push(entry);
  }
  const chains: string[][] = [];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const target of staticImports(file)) {
      if (target === COUNTRY) {
        const chain = [target];
        for (let step: string | null = file; step !== null; step = parent.get(step) ?? null) {
          chain.unshift(step);
        }
        chains.push(chain.map((step) => path.relative(SRC, step)));
      } else if (!parent.has(target) && !target.endsWith(".lazy.tsx")) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return chains;
}

describe("eager route imports", () => {
  it("never reach lib/country, whose top-level await would hold up the route", () => {
    expect(chainsToCountry(eagerRouteFiles()).map((chain) => chain.join(" -> "))).toEqual([]);
  });
});
