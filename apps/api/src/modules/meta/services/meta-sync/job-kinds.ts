import { META_JOB_KINDS } from "@openrift/shared/job-run-kinds";

const SOURCE_KIND = /^meta\.(?<source>[a-z]+)_/u;

export function sourceJobKinds(kind: string): string[] {
  const source = SOURCE_KIND.exec(kind)?.groups?.source;
  if (source === undefined) {
    return [kind];
  }
  return META_JOB_KINDS.filter((candidate) => candidate.startsWith(`meta.${source}_`));
}
