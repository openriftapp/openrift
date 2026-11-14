import { z } from "zod";

const fragmentSchema = z.object({ name: z.string(), start: z.number(), end: z.number() });

const reportSchema = z.object({
  statistics: z.object({ total: z.object({ sources: z.number() }) }),
  duplicates: z.array(
    z.object({ lines: z.number(), firstFile: fragmentSchema, secondFile: fragmentSchema }),
  ),
});

interface ClonePair {
  first: string;
  second: string;
  lines: number;
}

export function parseCloneReport(
  report: unknown,
  root: string,
): { sources: number; clones: ClonePair[] } {
  const parsed = reportSchema.parse(report);
  const prefix = `${root.replace(/\/+$/u, "")}/`;
  const location = (fragment: z.infer<typeof fragmentSchema>) =>
    `${fragment.name.startsWith(prefix) ? fragment.name.slice(prefix.length) : fragment.name}:${fragment.start}-${fragment.end}`;
  return {
    sources: parsed.statistics.total.sources,
    clones: parsed.duplicates
      .map((clone) => ({
        first: location(clone.firstFile),
        second: location(clone.secondFile),
        lines: clone.lines,
      }))
      .toSorted((a, b) => b.lines - a.lines || a.first.localeCompare(b.first)),
  };
}

export function formatClonePair(clone: ClonePair): string {
  return `${clone.first}  ${clone.second}  (${clone.lines} lines)`;
}

export function compareToCeiling(count: number, ceiling: number): "over" | "at" | "under" {
  if (count > ceiling) {
    return "over";
  }
  return count === ceiling ? "at" : "under";
}

const ceilingSchema = z.object({
  jscpd: z.string().regex(/^\d+\.\d+\.\d+$/u),
  clones: z.int().nonnegative(),
});

export function parseCeiling(text: string): z.infer<typeof ceilingSchema> {
  return ceilingSchema.parse(JSON.parse(text));
}

export function parseJscpdVersion(output: string): string | null {
  return /^jscpd (?<version>\d+\.\d+\.\d+)\s*$/u.exec(output.trim())?.groups?.version ?? null;
}
