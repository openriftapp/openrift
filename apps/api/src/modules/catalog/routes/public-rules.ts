import { rulesContract } from "@openrift/shared/contracts/rules";
import {
  cardMentionPattern,
  findCardMentions,
  ruleExampleText,
} from "@openrift/shared/rule-examples";
import {
  buildTermAnchors,
  buildTranslatedTermAnchors,
  sortRuleLanguages,
} from "@openrift/shared/rules";
import type { CardMentions, RuleHtmlOptions } from "@openrift/shared/rules-html";
import { escapeHtml, renderCommentHtml, renderRuleHtml } from "@openrift/shared/rules-html";
import type { KeywordBadge } from "@openrift/shared/rules-markdown";
import type {
  RuleChangeType,
  RuleKind,
  RuleLanguage,
  RuleNumbersResponse,
  RulePageEntry,
  RuleResponse,
  RulesListResponse,
  RulesPageResponse,
  RuleSourceResponse,
  RuleType,
  RuleVersionResponse,
  RuleVersionsListResponse,
} from "@openrift/shared/types/api/rules";
import type { CardType } from "@openrift/shared/types/enums";
import { getOrientation } from "@openrift/shared/utils";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

interface RuleRow {
  id: string;
  kind: RuleKind;
  language: RuleLanguage;
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
    language: row.language,
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
    language: row.language,
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
  language: RuleLanguage,
  rows: readonly RuleRow[],
): Promise<CardMentions | undefined> {
  if (!rows.some((row) => ruleExampleText(row.content, language) !== "")) {
    return undefined;
  }
  const cards = await repo.listCardNames(language);
  const pattern = cardMentionPattern(
    cards.map((card) => card.name),
    language,
  );
  if (pattern === null) {
    return undefined;
  }
  const slugsByName = new Map(cards.map((card) => [card.name, card.slug]));
  const mentioned = new Set<string>();
  for (const row of rows) {
    for (const name of findCardMentions(ruleExampleText(row.content, language), pattern)) {
      const slug = slugsByName.get(name);
      if (slug !== undefined) {
        mentioned.add(slug);
      }
    }
  }
  const images = mentioned.size > 0 ? await repo.listCardImages([...mentioned], language) : [];
  return {
    pattern,
    slugsByName,
    imagesBySlug: new Map(
      images.flatMap(({ slug, imageId, types }) =>
        imageId === null
          ? []
          : [[slug, { imageId, landscape: getOrientation(types as CardType[]) === "landscape" }]],
      ),
    ),
  };
}

async function loadKeywordBadges(
  repo: ApiContext["repos"]["rules"],
  language: RuleLanguage,
): Promise<Map<string, KeywordBadge>> {
  const labels = await repo.listKeywordLabels(language);
  return new Map(
    labels.map(({ label, name, color, darkText }) => [
      label.toLowerCase(),
      { name, color, darkText },
    ]),
  );
}

export const rulesRouter = {
  list: os.list.handler(async ({ input, context }): Promise<RulesListResponse> => {
    const { rules: repo } = context.repos;
    const { kind, version, language } = input;

    const rows = version
      ? await repo.listAtVersion(kind, language, version)
      : await repo.listLatest(kind, language);

    const versions = await repo.listVersions(language, kind);
    const latestVersion = versions.at(-1)?.version ?? "";
    const effectiveVersion = version ?? latestVersion;

    const changes = version ? await repo.listChangesAtVersion(kind, language, version) : null;

    return {
      kind,
      language,
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
    const { kind, version, language } = input;
    const rows = await repo.listAtVersion(kind, language, version);
    const termAnchors =
      language === "en"
        ? buildTermAnchors(rows)
        : buildTranslatedTermAnchors(
            buildTermAnchors(await repo.listAtVersion(kind, "en", version)),
            rows,
            language,
          );
    const html = {
      language,
      termAnchors,
      cardMentions: await loadCardMentions(repo, language, rows),
      keywords: await loadKeywordBadges(repo, language),
    };
    return { kind, language, version, rules: rows.map((row) => toPageEntry(row, html)) };
  }),

  source: os.source.handler(async ({ input, context }): Promise<RuleSourceResponse> => {
    const { rules: repo } = context.repos;
    const { kind, version, language } = input;
    const changes = await repo.listChangesAtVersion(kind, language, version);
    return {
      added: changes.added,
      modified: changes.modified,
      current: changes.current,
      modifiedPrev: changes.modifiedPrev,
      removed: changes.removed.map((row) => ({
        ...toPageEntry(row, { language, termAnchors: NO_TERM_ANCHORS }),
        content: row.content,
      })),
    };
  }),

  numbers: os.numbers.handler(async ({ input, context }): Promise<RuleNumbersResponse> => {
    const rows = await context.repos.rules.listAtVersion(input.kind, "en", input.version);
    return { numbers: rows.map((row) => row.ruleNumber) };
  }),

  versions: os.versions.handler(async ({ input, context }): Promise<RuleVersionsListResponse> => {
    const { rules: repo } = context.repos;
    const { kind, language } = input;
    const all = await repo.listAllVersions(kind);
    const byKey = Map.groupBy(all, (r) => `${r.kind} ${r.version}`);
    return {
      versions: all
        .filter((r) => r.language === language)
        .map((r): RuleVersionResponse => {
          const siblings = byKey.get(`${r.kind} ${r.version}`) ?? [];
          const fallback = siblings.find((sibling) => sibling.language === "en");
          const comments = r.comments ?? fallback?.comments ?? null;
          return {
            kind: r.kind,
            language: r.language,
            version: r.version,
            comments,
            commentsHtml: comments === null ? null : renderCommentHtml(comments),
            label: r.label ?? fallback?.label ?? null,
            documentVersion: r.documentVersion ?? fallback?.documentVersion ?? null,
            importedAt: r.importedAt.toISOString(),
            languages: sortRuleLanguages(siblings.map((sibling) => sibling.language)),
          };
        }),
      languages: sortRuleLanguages(new Set(all.map((r) => r.language))),
    };
  }),
};
