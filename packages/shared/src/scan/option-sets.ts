/** `--set path=value` overrides for a replay: parsed from argv and merged into a plan. */

export type SetValue = number | boolean | null;

export interface OptionSet {
  path: string[];
  value: SetValue;
}

type OptionRecord = Record<string, unknown>;

function isRecord(value: unknown): value is OptionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSetValue(raw: string, arg: string): SetValue {
  if (raw === "true" || raw === "false") {
    return raw === "true";
  }
  if (raw === "null") {
    return null;
  }
  const value = raw.trim() === "" ? Number.NaN : Number(raw);
  if (Number.isNaN(value)) {
    throw new TypeError(`--set ${arg}: value must be a number, true, false or null`);
  }
  return value;
}

export function parseSets(argv: readonly string[]): OptionSet[] {
  return argv.flatMap((arg, index) => {
    if (arg !== "--set") {
      return [];
    }
    const assignment = argv[index + 1] ?? "";
    const equals = assignment.indexOf("=");
    const path = assignment.slice(0, Math.max(equals, 0)).split(".");
    if (equals <= 0 || path.some((segment) => segment === "")) {
      throw new Error(`--set ${assignment}: expected path=value`);
    }
    return [{ path, value: parseSetValue(assignment.slice(equals + 1), assignment) }];
  });
}

function setPath(
  target: OptionRecord,
  defaults: unknown,
  path: readonly string[],
  value: SetValue,
  name: string,
): OptionRecord {
  const [head = "", ...rest] = path;
  const fallback = isRecord(defaults) ? defaults[head] : undefined;
  const current = target[head] ?? fallback;
  if (current === undefined) {
    throw new Error(`--set ${name}: no such option`);
  }
  if (rest.length > 0) {
    if (!isRecord(current)) {
      throw new Error(`--set ${name}: ${head} is not an option group`);
    }
    return { ...target, [head]: setPath(current, fallback, rest, value, name) };
  }
  if (value === null && fallback !== undefined) {
    return { ...target, [head]: fallback };
  }
  if (value === null) {
    return Object.fromEntries(Object.entries(target).filter(([key]) => key !== head));
  }
  if (typeof current !== typeof value) {
    throw new TypeError(`--set ${name}: expected a ${typeof current}`);
  }
  return { ...target, [head]: value };
}

/** A group the plan leaves out starts from `defaults`; `null` restores the default, or deletes a key without one. */
export function applySets<T extends object>(
  options: T,
  defaults: object,
  sets: readonly OptionSet[],
): T {
  let merged = { ...options } as OptionRecord;
  for (const { path, value } of sets) {
    merged = setPath(merged, defaults, path, value, path.join("."));
  }
  return merged as T;
}
