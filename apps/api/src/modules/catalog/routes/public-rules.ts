import { rulesContract } from "@openrift/shared/contracts/rules";
import { cardMentionPattern, ruleExampleText } from "@openrift/shared/rule-examples";
import { buildTermAnchors } from "@openrift/shared/rules";
import type { CardMentions, RuleHtmlOptions } from "@openrift/shared/rules-html";
import { escapeHtml, renderCommentHtml, renderRuleHtml } from "@openrift/shared/rules-html";
import type {
  RuleChangeType,
  RuleKind,
  RulePageEntry,
  RuleResponse,
  RulesListResponse,
  RulesPageResponse,
  RuleSourceResponse,
  RuleType,
  RuleVersionResponse,
  RuleVersionsListResponse,
} from "@openrift/shared/types/api/rules";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

interface RuleRow {
  id: string;
  kind: RuleKind;
  version: string;
  ruleNumber: string;
  sortOrder: number;
  depth: number;
  ruleType: RuleType;
  content: string;
  changeType: RuleChangeType;
}

function toRuleResponse(row: RuleRow): RuleResponse {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    ruleNumber: row.ruleNumber,
    sortOrder: row.sortOrder,
    depth: row.depth,
    ruleType: row.ruleType,
    content: row.content,
    changeType: row.changeType,
  };
}

function toPageEntry(row: RuleRow, html: Omit<RuleHtmlOptions, "ruleNumber">): RulePageEntry {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    ruleNumber: row.ruleNumber,
    sortOrder: row.sortOrder,
    depth: row.depth,
    ruleType: row.ruleType,
    contentHtml:
      row.ruleType === "text"
        ? renderRuleHtml(row.content, { ...html, ruleNumber: row.ruleNumber })
        : escapeHtml(row.content),
    changeType: row.changeType,
  };
}

const NO_TERM_ANCHORS: ReadonlyMap<string, string> = new Map();

const os = implement(rulesContract).$context<ApiContext>().use(requireUser);

async function loadCardMentions(
  repo: ApiContext["repos"]["rules"],
  rows: readonly RuleRow[],
): Promise<CardMentions | undefined> {
  if (!rows.some((row) => ruleExampleText(row.content) !== "")) {
    return undefined;
  }
  const cards = await repo.listCardNames();
  const pattern = cardMentionPattern(cards.map((card) => card.name));
  if (pattern === null) {
    return undefined;
  }
  return { pattern, slugsByName: new Map(cards.map((card) => [card.name, card.slug])) };
}

export const rulesRouter = {
  list: os.list.handler(async ({ input, context }): Promise<RulesListResponse> => {
    const { rules: repo } = context.repos;
    const { kind, version } = input;

    const rows = version ? await repo.listAtVersion(kind, version) : await repo.listLatest(kind);

    const versions = await repo.listVersions(kind);
    const latestVersion = versions.at(-1)?.version ?? "";
    const effectiveVersion = version ?? latestVersion;

    const changes = version ? await repo.listChangesAtVersion(kind, version) : null;

    return {
      kind,
      rules: rows.map((row) => toRuleResponse(row)),
      version: effectiveVersion,
      ...(changes
        ? {
            changes: {
              added: changes.added,
              modifiedPrev: changes.modifiedPrev,
              removed: changes.removed.map((row) => toRuleResponse(row)),
            },
          }
        : {}),
    };
  }),

  page: os.page.handler(async ({ input, context }): Promise<RulesPageResponse> => {
    const { rules: repo } = context.repos;
    const { kind, version } = input;
    const rows = await repo.listAtVersion(kind, version);
    const html = {
      termAnchors: buildTermAnchors(rows),
      cardMentions: await loadCardMentions(repo, rows),
    };
    return { kind, version, rules: rows.map((row) => toPageEntry(row, html)) };
  }),

  source: os.source.handler(async ({ input, context }): Promise<RuleSourceResponse> => {
    const { rules: repo } = context.repos;
    const changes = await repo.listChangesAtVersion(input.kind, input.version);
    return {
      added: changes.added,
      current: changes.current,
      modifiedPrev: changes.modifiedPrev,
      removed: changes.removed.map((row) => ({
        ...toPageEntry(row, { termAnchors: NO_TERM_ANCHORS }),
        content: row.content,
      })),
    };
  }),

  versions: os.versions.handler(async ({ input, context }): Promise<RuleVersionsListResponse> => {
    const { rules: repo } = context.repos;
    const rows = await repo.listVersions(input.kind);
    return {
      versions: rows.map((r): RuleVersionResponse => ({
        kind: r.kind as RuleKind,
        version: r.version,
        comments: r.comments,
        commentsHtml: r.comments === null ? null : renderCommentHtml(r.comments),
        label: r.label,
        documentVersion: r.documentVersion,
        importedAt: r.importedAt.toISOString(),
      })),
    };
  }),
};
