import { adminRulesContract } from "@openrift/shared/contracts/admin/rules";
import { createLogger } from "@openrift/shared/logger";
import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { purgeCloudflarePaths } from "../../system/services/cloudflare-purge.js";
import {
  duplicateRuleNumbers,
  parseRulesText,
  retypeLanguage,
  saveRulesVersion,
} from "../lib/rule-versions.js";

const log = createLogger("admin-rules");

const os = implement(adminRulesContract).$context<ApiContext>().use(requireAuthedUser);

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

  saveVersion: os.saveVersion.handler(async ({ input, context, errors }) => {
    const { kind, language, version, content, comments, label, documentVersion } = input;

    if (language !== "en" && !(await context.repos.rules.getVersion(kind, "en", version))) {
      throw errors.BAD_REQUEST({
        message: `Version "${version}" has no English original for kind "${kind}". Import the English version first.`,
      });
    }

    const rules = parseRulesText(content);
    if (rules.length === 0) {
      throw errors.BAD_REQUEST({ message: "No valid rules found in content" });
    }
    const duplicates = duplicateRuleNumbers(rules);
    if (duplicates.length > 0) {
      throw errors.BAD_REQUEST({
        message: `Duplicate rule numbers: ${duplicates.join(", ")}`,
      });
    }

    const result = await context.transact((txRepos) =>
      saveRulesVersion(txRepos.rules, { kind, language, version }, rules, {
        comments,
        label,
        documentVersion,
      }),
    );

    if (result.status !== "unchanged") {
      await purgeRulesPages(context, kind);
    }

    return { kind, language, version, ...result };
  }),

  removeVersion: os.removeVersion.handler(async ({ input, context, errors }): Promise<void> => {
    const { rules: repo } = context.repos;
    const { kind, language, version } = input;

    const existing = await repo.getVersion(kind, language, version);
    if (!existing) {
      throw errors.NOT_FOUND({
        message: `Version "${version}" not found for kind "${kind}" in "${language}"`,
      });
    }
    if (language === "en") {
      const translations = await repo.listTranslations(kind, version);
      if (translations.length > 0) {
        throw errors.CONFLICT({
          message: `Version "${version}" still has translations (${translations.map((t) => t.language).join(", ")}). Delete them first.`,
        });
      }
    }

    await context.transact(async (txRepos) => {
      await txRepos.rules.deleteVersion(kind, language, version);
      await retypeLanguage(txRepos.rules, kind, language);
    });
    await purgeRulesPages(context, kind, { language, version });
  }),

  updateVersion: os.updateVersion.handler(async ({ input, context, errors }) => {
    const { rules: repo } = context.repos;
    const { kind, language, version, comments, label, documentVersion } = input;

    const updated = await repo.updateDetails(kind, language, version, {
      comments,
      label,
      documentVersion,
    });
    if (!updated) {
      throw errors.NOT_FOUND({
        message: `Version "${version}" not found for kind "${kind}" in "${language}"`,
      });
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
