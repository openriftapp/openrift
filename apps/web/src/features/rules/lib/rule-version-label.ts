import type { RuleVersionResponse } from "@openrift/shared/types/api/rules";

type VersionNaming = Pick<RuleVersionResponse, "version" | "label" | "documentVersion">;

export function ruleVersionLabel(entry: VersionNaming): string {
  const name = [entry.documentVersion, entry.label].filter(Boolean).join(" · ");
  return name ? `${name} (${entry.version})` : entry.version;
}

export function ruleVersionLabels(versions: readonly VersionNaming[]): Map<string, string> {
  return new Map(versions.map((entry) => [entry.version, ruleVersionLabel(entry)]));
}
