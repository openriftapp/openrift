import { adminRulesContract } from "@openrift/shared/contracts/admin/rules";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { createLogger } from "@openrift/shared/logger";
import type {
  RuleChangeType,
  RuleKind,
  RuleLanguage,
  RuleType,
} from "@openrift/shared/types/api/rules";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { purgeCloudflarePaths } from "../../system/services/cloudflare-purge.js";

const log = createLogger("admin-rules");

const os = implement(adminRulesContract).$context<ApiContext>().use(requireAuthedUser);

interface ParsedRule {
  ruleNumber: string;
  ruleType: RuleType;
  content: string;
  depth: number;
  sortOrder: number;
}

/** Depth of a rule number from its dot-separated segments: 0 for "100", 1 for "100.1", 2 for "100.1.a", 3 for "100.1.a.1". */
function computeDepth(ruleNumber: string): number {
  const parts = ruleNumber.split(".");
  return Math.min(parts.length - 1, 3);
}

const RULE_LINE_REGEX = /^(?<number>\d+(?:\.[A-Za-z0-9]+)*)\.\s+(?<rest>.*)$/u;

/**
 * Parses the markdown rule format into rule rows. Each non-blank line is
 * `<rule_number>. <markdown_content>`, where a leading `# ` marks a title and
 * `## ` a subtitle. Literal `\n` sequences in the content become real newlines
 * so a single line can hold a multi-paragraph rule.
 */
export function parseRulesText(text: string): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const lines = text.split("\n");
  let sortOrder = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("===")) {
      continue;
    }

    const match = RULE_LINE_REGEX.exec(line);
    if (!match) {
      continue;
    }

    const ruleNumber = match[1];
    // Tolerate a leading "| " column-separator from sources that mirror the
    // legacy pipe-delimited format.
    const rest = match[2]?.replace(/^\|\s*/u, "");
    if (!ruleNumber || !rest) {
      continue;
    }

    let ruleType: ParsedRule["ruleType"] = "text";
    let content = rest;
    if (rest.startsWith("## ")) {
      ruleType = "subtitle";
      content = rest.slice(3);
    } else if (rest.startsWith("# ")) {
      ruleType = "title";
      content = rest.slice(2);
    }

    content = content.replaceAll(String.raw`\n`, "\n").trim();
    if (!content) {
      continue;
    }

    rules.push({
      ruleNumber,
      ruleType,
      content,
      depth: computeDepth(ruleNumber),
      sortOrder,
    });
    sortOrder++;
  }

  return rules;
}

/**
 * Every version page lists all versions and languages, so any change purges them all
 * from the edge, which keeps them for a day. Best effort: a failure is only logged.
 */
async function purgeRulesPages(
  context: ApiContext,
  kind: RuleKind,
  removed?: { language: RuleLanguage; version: string },
): Promise<void> {
  const { cloudflare, appBaseUrl } = context.config;
  if (!cloudflare || !appBaseUrl) {
    return;
  }
  try {
    const versions = await context.repos.rules.listAllVersions(kind);
    const pages = removed === undefined ? versions : [...versions, removed];
    const paths = [
      "/rules",
      `/rules/${kind}`,
      ...pages.map((page) => `/rules/${kind}?lang=${page.language}`),
      ...pages.flatMap((page) => [
        `/rules/${kind}/${page.version}`,
        `/rules/${kind}/${page.version}?lang=${page.language}`,
      ]),
    ];
    const failures = await purgeCloudflarePaths(cloudflare, context.io.fetch, appBaseUrl, paths);
    if (failures.length > 0) {
      log.warn({ kind, failures }, "Cloudflare purge of rules pages failed");
    }
  } catch (error) {
    log.warn({ kind, err: error }, "Cloudflare purge of rules pages failed");
  }
}

/**
 * Admin rules management. Conflict / bad-request / not-found states are thrown
 * as `AppError` and mapped by the handler's {@link appErrorInterceptor}.
 */
export const adminRulesRouter = {
  listVersions: os.listVersions.handler(async ({ context }) => {
    const rows = await context.repos.rules.listAllVersions();
    return {
      versions: rows.map((row) => ({
        kind: row.kind,
        language: row.language,
        version: row.version,
        comments: row.comments,
        label: row.label,
        documentVersion: row.documentVersion,
        importedAt: row.importedAt.toISOString(),
      })),
    };
  }),

  import: os.import.handler(async ({ input, context }) => {
    const { rules: repo } = context.repos;
    const transact = context.transact;
    const body = input;

    const { kind, language } = body;
    const existing = await repo.getVersion(kind, language, body.version);
    if (existing) {
      throw new AppError(
        409,
        ERROR_CODES.CONFLICT,
        `Version "${body.version}" already exists for kind "${kind}" in "${language}"`,
      );
    }
    if (language !== "en" && !(await repo.getVersion(kind, "en", body.version))) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        `Version "${body.version}" has no English original for kind "${kind}". Import the English version first.`,
      );
    }

    const parsed = parseRulesText(body.content);
    if (parsed.length === 0) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, "No valid rules found in content");
    }

    // Versions are ordered ASC so `at(-1)` is the highest existing version.
    const versions = await repo.listVersions(language, kind);
    const previousVersion = versions.at(-1)?.version;

    // The diff model assumes versions arrive in chronological order. Importing
    // a version older than what's already on file would corrupt reads of the
    // existing newer versions. Reject up front.
    if (previousVersion && body.version < previousVersion) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        `Version "${body.version}" is older than the latest "${previousVersion}" for kind "${kind}" in "${language}". Imports must arrive in chronological order — delete newer versions first if you need to insert an older one.`,
      );
    }

    let previousRulesMap = new Map<string, string>();
    if (previousVersion) {
      const previousRules = await repo.listLatest(kind, language);
      previousRulesMap = new Map(previousRules.map((r) => [r.ruleNumber, r.content]));
    }

    const newRuleNumbers = new Set(parsed.map((r) => r.ruleNumber));
    const rulesWithChanges: {
      kind: RuleKind;
      language: RuleLanguage;
      version: string;
      ruleNumber: string;
      sortOrder: number;
      depth: number;
      ruleType: RuleType;
      content: string;
      changeType: RuleChangeType;
    }[] = [];

    let added = 0;
    let modified = 0;
    let removed = 0;

    if (previousVersion) {
      for (const rule of parsed) {
        const previousContent = previousRulesMap.get(rule.ruleNumber);
        if (previousContent === undefined) {
          rulesWithChanges.push({
            kind,
            language,
            version: body.version,
            ...rule,
            changeType: "added",
          });
          added++;
        } else if (previousContent !== rule.content) {
          rulesWithChanges.push({
            kind,
            language,
            version: body.version,
            ...rule,
            changeType: "modified",
          });
          modified++;
        }
      }

      for (const [ruleNumber] of previousRulesMap) {
        if (!newRuleNumbers.has(ruleNumber)) {
          rulesWithChanges.push({
            kind,
            language,
            version: body.version,
            ruleNumber,
            sortOrder: parsed.length + removed,
            depth: 0,
            ruleType: "text",
            content: "",
            changeType: "removed",
          });
          removed++;
        }
      }
    } else {
      const englishRows =
        language === "en" ? null : await repo.listChangeTypesAtVersion(kind, "en", body.version);
      const englishChangeTypes =
        englishRows === null
          ? null
          : new Map(englishRows.map((row) => [row.ruleNumber, row.changeType]));
      for (const rule of parsed) {
        const englishChangeType = englishChangeTypes?.get(rule.ruleNumber);
        const changeType: RuleChangeType =
          englishChangeTypes === null
            ? "added"
            : englishChangeType === "added" || englishChangeType === "modified"
              ? englishChangeType
              : "unchanged";
        rulesWithChanges.push({
          kind,
          language,
          version: body.version,
          ruleNumber: rule.ruleNumber,
          sortOrder: rule.sortOrder,
          depth: rule.depth,
          ruleType: rule.ruleType,
          content: rule.content,
          changeType,
        });
        if (changeType === "added") {
          added++;
        } else if (changeType === "modified") {
          modified++;
        }
      }
      for (const [ruleNumber, changeType] of englishChangeTypes ?? []) {
        if (changeType === "removed" && !newRuleNumbers.has(ruleNumber)) {
          rulesWithChanges.push({
            kind,
            language,
            version: body.version,
            ruleNumber,
            sortOrder: parsed.length + removed,
            depth: 0,
            ruleType: "text",
            content: "",
            changeType: "removed",
          });
          removed++;
        }
      }
    }

    await transact(async (txRepos) => {
      await txRepos.rules.createVersion({
        kind,
        language,
        version: body.version,
        comments: body.comments ?? null,
        label: body.label ?? null,
        documentVersion: body.documentVersion ?? null,
      });

      if (rulesWithChanges.length > 0) {
        await txRepos.rules.insertRules(rulesWithChanges);
      }
    });

    await purgeRulesPages(context, kind);

    return {
      kind,
      language,
      version: body.version,
      rulesCount: rulesWithChanges.length,
      added,
      modified,
      removed,
    };
  }),

  removeVersion: os.removeVersion.handler(async ({ input, context }): Promise<void> => {
    const { rules: repo } = context.repos;
    const { kind, language, version } = input;

    const existing = await repo.getVersion(kind, language, version);
    if (!existing) {
      throw new AppError(
        404,
        ERROR_CODES.NOT_FOUND,
        `Version "${version}" not found for kind "${kind}" in "${language}"`,
      );
    }
    if (language === "en") {
      const translations = await repo.listTranslations(kind, version);
      if (translations.length > 0) {
        throw new AppError(
          409,
          ERROR_CODES.CONFLICT,
          `Version "${version}" still has translations (${translations.map((t) => t.language).join(", ")}). Delete them first.`,
        );
      }
    }

    await repo.deleteVersion(kind, language, version);
    await purgeRulesPages(context, kind, { language, version });
  }),

  updateVersion: os.updateVersion.handler(async ({ input, context }) => {
    const { rules: repo } = context.repos;
    const { kind, language, version, comments, label, documentVersion } = input;

    const updated = await repo.updateDetails(kind, language, version, {
      comments,
      label,
      documentVersion,
    });
    if (!updated) {
      throw new AppError(
        404,
        ERROR_CODES.NOT_FOUND,
        `Version "${version}" not found for kind "${kind}" in "${language}"`,
      );
    }

    await purgeRulesPages(context, kind);

    return {
      kind: updated.kind,
      language: updated.language,
      version: updated.version,
      comments: updated.comments,
      label: updated.label,
      documentVersion: updated.documentVersion,
    };
  }),
};
