// Paraglide types every message input as `NonNullable<unknown>`, so a string
// passed where a number local is expected compiles and renders as NaN.
// oxlint-disable-next-line import/no-nodejs-modules -- test reads the source tree as text
import { readdirSync, readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- test reads the source tree as text
import path from "node:path";

import { describe, expect, it } from "vitest";

interface Variant {
  declarations: string[];
}
type Message = string | Variant[];

const srcDir = path.resolve(__dirname, "..");

const messages = JSON.parse(
  readFileSync(path.resolve(srcDir, "../messages/en.json"), "utf-8"),
) as Record<string, Message>;

const numericInputs = new Map<string, string[]>();
for (const [key, message] of Object.entries(messages)) {
  if (typeof message === "string") {
    continue;
  }
  const inputs = new Set<string>();
  for (const variant of message) {
    for (const declaration of variant.declarations) {
      const input = /^local \w+ = (?<name>\w+): (?:number|plural|ordinal)$/u.exec(declaration)
        ?.groups?.name;
      if (input !== undefined) {
        inputs.add(input);
      }
    }
  }
  if (inputs.size > 0) {
    numericInputs.set(key, [...inputs]);
  }
}

const sourceFiles = readdirSync(srcDir, { recursive: true, encoding: "utf-8" })
  .filter((file) => /\.tsx?$/u.test(file) && !file.startsWith("paraglide/"))
  .map((file) => ({
    file: `src/${file}`,
    source: readFileSync(path.resolve(srcDir, file), "utf-8"),
  }));

/** Reads the expression that follows `start`, stopping at the comma that ends it. */
function expressionAt(source: string, start: number): string {
  let depth = 0;
  let end = start;
  while (end < source.length) {
    const char = source[end]!;
    if ("({[".includes(char)) {
      depth += 1;
    } else if (")}]".includes(char)) {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char === "," && depth === 0) {
      break;
    }
    end += 1;
  }
  return source.slice(start, end);
}

function preFormatted(): string[] {
  const found: string[] = [];
  for (const { file, source } of sourceFiles) {
    for (const call of source.matchAll(/\bm\.(?<key>\w+)\(/gu)) {
      const inputs = numericInputs.get(call.groups?.key ?? "");
      if (inputs === undefined) {
        continue;
      }
      const args = expressionAt(source, call.index + call[0].length);
      for (const input of inputs) {
        const assignment = new RegExp(`\\b${input}\\s*:`, "u").exec(args);
        if (assignment === null) {
          continue;
        }
        const value = expressionAt(args, assignment.index + assignment[0].length).trim();
        if (/\bformat\w*\(|\bString\(|\.toLocaleString\(|\.toFixed\(/u.test(value)) {
          const line = source.slice(0, call.index).split("\n").length;
          found.push(`${file}:${line} ${call.groups?.key}: ${input}: ${value}`);
        }
      }
    }
  }
  return found;
}

describe("number inputs of messages", () => {
  it("finds the messages that format a number themselves", () => {
    expect(numericInputs.get("meta_show_all_n")).toEqual(["count"]);
    expect(numericInputs.size).toBeGreaterThan(100);
  });

  it("passes no already-formatted number into a message", () => {
    expect(preFormatted()).toEqual([]);
  });
});
