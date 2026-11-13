import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;
const SHARED_SRC = path.resolve(SRC, "../../../packages/shared/src");

function sourceFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter(
      (file) =>
        /\.tsx?$/u.test(file) &&
        !/\.test\.tsx?$/u.test(file) &&
        !file.startsWith("paraglide") &&
        !file.endsWith("routeTree.gen.ts"),
    )
    .map((file) => path.join(root, file));
}

const WEB_FILES = sourceFiles(SRC);
const ALL_FILES = [...WEB_FILES, ...sourceFiles(SHARED_SRC)];

function relative(file: string): string {
  return path.relative(path.resolve(SRC, "../../.."), file);
}

function offenders(files: readonly string[], pattern: RegExp, allowed: readonly string[] = []) {
  return files
    .map((file) => relative(file))
    .filter(
      (file) =>
        !allowed.includes(file) &&
        pattern.test(readFileSync(path.resolve(SRC, "../../..", file), "utf-8")),
    );
}

const ADMIN_COPY_DIRS = [
  "features/admin/",
  "features/catalog-workspace/",
  "features/marketing/",
  "components/ui/",
];
const NON_COPY_FILES = [
  "features/contribute/components/card-text-input.tsx",
  "features/tournaments/components/deck-check-ingest-guide.tsx",
  "features/cards/components/catalog-card-slug-search.tsx",
];
const KEY_CAPS = new Set(["esc"]);
const NON_WORDS = new Set([
  "OpenRift",
  "Discord",
  "Google",
  "Esc",
  "Ctrl",
  "Riot",
  "Piltover",
  "Archive",
]);
const COPY_ATTRIBUTES = new Set(["aria-label", "title", "alt", "label", "description"]);
const SAMPLE_ATTRIBUTES = new Set(["placeholder"]);
const SAMPLE_VALUE = /^(?:https?:\/\/|[\w.+-]+@[\w.-]+$|Whiskers von Catsworth$)/u;
const RAW_CARD_NAME_DIRS = [
  "features/admin/",
  "features/catalog-workspace/",
  "features/contribute/",
  "features/designer/",
  "features/marketing/",
];
const RAW_CARD_NAME_EXPRESSIONS: Record<string, readonly string[]> = {
  "apps/web/src/features/cards/components/card-thumbnail.tsx": ["name={card.name}"],
  "apps/web/src/features/cards/components/card-page-hero.tsx": ["name={card.name}"],
  "apps/web/src/features/cards/components/card-detail/card-image.tsx": ["name={card.name}"],
  "apps/web/src/features/board-states/components/board-state-editor-workspace.tsx": [
    "{draft.card.name}",
  ],
  "apps/web/src/features/collections/lib/custom-tag-bulk-import.ts": ["name: card.name })"],
  "apps/web/src/features/meta/components/meta-inferred-slots.tsx": ["{card.name}"],
};

function offendersExcept(
  files: readonly string[],
  pattern: RegExp,
  allowedExpressions: Readonly<Record<string, readonly string[]>>,
) {
  return files
    .map((file) => relative(file))
    .filter((file) => {
      let text = readFileSync(path.resolve(SRC, "../../..", file), "utf-8");
      for (const expression of allowedExpressions[file] ?? []) {
        text = text.replaceAll(expression, "");
      }
      return pattern.test(text);
    });
}

function copyLiterals(file: string, returnsCopy = false): string[] {
  const source = readFileSync(file, "utf-8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const isProse = (text: string) =>
    (text.replaceAll(/&#?\w+;/gu, "").match(/\b[a-z]{3,}\b/gu) ?? []).some(
      (word) => !KEY_CAPS.has(word),
    );
  const hasWord = (text: string) =>
    isProse(text) ||
    (text.match(/\b[A-Z][a-z]{2,}\b/gu) ?? []).some((word) => !NON_WORDS.has(word));
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasWord(node.getText())) {
      found.push(node.getText().trim());
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer)
    ) {
      const name = node.name.getText();
      const value = node.initializer.text;
      const copy = COPY_ATTRIBUTES.has(name) && hasWord(value);
      const sample = SAMPLE_ATTRIBUTES.has(name) && isProse(value) && !SAMPLE_VALUE.test(value);
      if (copy || sample) {
        found.push(`${name}=${node.initializer.getText()}`);
      }
    }
    if (
      ts.isReturnStatement(node) &&
      returnsCopy &&
      node.expression !== undefined &&
      (ts.isStringLiteral(node.expression) ||
        ts.isNoSubstitutionTemplateLiteral(node.expression)) &&
      /\s/u.test(node.expression.text) &&
      isProse(node.expression.text)
    ) {
      found.push(`return ${node.expression.getText()}`);
    }
    if (
      ts.isCallExpression(node) &&
      /^toast(?:\.\w+)?$/u.test(node.expression.getText()) &&
      node.arguments[0] !== undefined &&
      (ts.isStringLiteral(node.arguments[0]) ||
        ts.isTemplateExpression(node.arguments[0]) ||
        ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
    ) {
      found.push(node.arguments[0].getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("source conventions", () => {
  it("renders player-facing copy through messages", () => {
    const literals = WEB_FILES.filter(
      (file) =>
        file.endsWith(".tsx") || file.includes("/hooks/") || /\/features\/[^/]+\/lib\//u.test(file),
    )
      .filter((file) => {
        const rel = path.relative(SRC, file);
        return !ADMIN_COPY_DIRS.some((dir) => rel.startsWith(dir)) && !NON_COPY_FILES.includes(rel);
      })
      .flatMap((file) =>
        copyLiterals(file, file.includes("/lib/")).map(
          (text) => `${path.relative(SRC, file)}: ${text}`,
        ),
      );

    expect(literals).toEqual([]);
  });

  it("takes day and hour lengths from the shared date module", () => {
    expect(
      offenders(
        ALL_FILES,
        /\b(?:24 \* 60 \* 60 \* 1000|60 \* 60 \* 1000|86_?400_?000|3_?600_?000)\b|const (?:DAY_MS|HOUR_MS|MS_PER_DAY|MS_PER_HOUR)\b/u,
        ["packages/shared/src/format-date.ts"],
      ),
    ).toEqual([]);
  });

  it("reads a UTC day key through formatDay", () => {
    expect(
      offenders(ALL_FILES, /\.toISOString\(\)\.slice\(0, 10\)/u, [
        "packages/shared/src/format-date.ts",
      ]),
    ).toEqual([]);
  });

  it("pluralizes through messages or the shared pluralize", () => {
    expect(
      offenders(
        ALL_FILES,
        /(?:[=!]==|>) 1 \? "s?" : "s?"|(?:[=!]==|>) 1 \? "(?<stem>[a-z]{3})[a-z ]*" : "\k<stem>[a-z ]*"|function plural\(/u,
      ),
    ).toEqual([]);
  });

  it("omits a missing owner name instead of naming it", () => {
    expect(offenders(ALL_FILES, /"Anonymous"/u)).toEqual([]);
  });

  it("builds label maps from rows, leaving hand-written ones to tests", () => {
    expect(
      offenders(ALL_FILES, /\blabelMapOf\(/u, [
        "packages/shared/src/enum-label.ts",
        "apps/web/src/test/zone-order-stub.ts",
      ]),
    ).toEqual([]);
  });

  it("gives avatars the real name, never the nameless placeholder", () => {
    expect(
      offenders(WEB_FILES, /<(?:UserAvatar|PersonPageHeader)\b[^>]*?\bname=\{memberName\(/su),
    ).toEqual([]);
  });

  it("names deck zones only through the admin-managed labels", () => {
    expect(offenders(ALL_FILES, /\bZONE_LABELS\b|\bsentenceCaseSlug\b/u)).toEqual([]);
  });

  it("shows a card's name only through legendDisplayName", () => {
    const files = WEB_FILES.filter(
      (file) => !RAW_CARD_NAME_DIRS.some((dir) => path.relative(SRC, file).startsWith(dir)),
    );
    expect(
      offendersExcept(
        files,
        /\{\s*[\w?.]*\bcard\??\.name\s*\}|: [\w?.]*\bcard\??\.name\s*\}\)|\$\{[\w?.]*\bcard\??\.name\}/u,
        RAW_CARD_NAME_EXPRESSIONS,
      ),
    ).toEqual([]);
  });

  it("builds card lookups only through the shared lookup builders", () => {
    expect(
      offenders(
        ALL_FILES,
        /\bbuildCardIndex\b|\bcardSearchAltNames\(|import \* as \w+ from "@openrift\/shared\/card-search"/u,
        [
          "packages/shared/src/card-lookup.ts",
          "packages/shared/src/card-name.ts",
          "packages/shared/src/card-search.ts",
          "packages/shared/src/filters-search.ts",
        ],
      ),
    ).toEqual([]);
  });

  it("matches typed text only through the shared folding matchers", () => {
    expect(
      offendersExcept(
        ALL_FILES,
        /\.to(?:Locale)?LowerCase\(\)\.(?:includes|startsWith|indexOf|split)\(|\bconst (?:needle|query|folded) = [^;]*\.to(?:Locale)?LowerCase\(\);|foldForSearch\([^)]*\)\.includes\(/u,
        {
          "apps/web/src/features/admin/components/printing-desk-marker-picker.tsx": [
            "const needle = typed.trim().toLowerCase();",
          ],
          "apps/web/src/features/cards/lib/query-filters.ts": [
            "const folded = wanted.trim().toLowerCase();",
          ],
          "apps/web/src/features/collections/lib/import-parsers.ts": [
            'variantType.trim().toLowerCase().startsWith("overnumbered")',
          ],
          "packages/shared/src/search-query/bind.ts": [
            "entry.value.toLowerCase().startsWith(wanted)",
          ],
          "packages/shared/src/search-fold.ts": ["foldForSearch(field).includes(needle)"],
        },
      ),
    ).toEqual([]);
  });

  it("builds card image srcSet strings only through imageSrcSet", () => {
    expect(offenders(ALL_FILES, /\$\{imageUrl\([^)]*\)\} \d+w/u)).toEqual([]);
  });

  it("takes the card aspect ratio from the shared constant or the --aspect-card variables", () => {
    expect(
      offenders(
        ALL_FILES,
        /\b0\.71\d\b|aspect-\[(?:63\/88|88\/63)\]|\b(?:63|88) ?\/ ?(?:88|63)\b|\*1\.4\b/u,
        ["packages/shared/src/card-orientation.ts"],
      ),
    ).toEqual([]);
    const css = readFileSync(path.join(SRC, "index.css"), "utf-8");
    expect(css).toContain("--aspect-card: 63 / 88;");
    expect(css).toContain("--aspect-card-landscape: 88 / 63;");
  });

  it("detects the session cookie in one place", () => {
    expect(
      offenders(WEB_FILES, /better-auth\\?\.session_token/u, [
        "apps/web/src/lib/session-cookie.ts",
      ]),
    ).toEqual([]);
  });

  it("names the site host only through getSiteHost or OFFICIAL_HOST", () => {
    expect(
      offenders(ALL_FILES, /(?<!@)openrift\.app/u, [
        "apps/web/src/lib/official-host.ts",
        "packages/shared/src/link-hosts.ts",
      ]),
    ).toEqual([]);
  });

  it("names downloads only through downloadFilename", () => {
    expect(
      offenders(ALL_FILES, /\.replaceAll\(\/\[\^(?:\\w|a-z0-9\]\+)/u, [
        "packages/shared/src/strings.ts",
        // A channel slug suggestion, not a filename.
        "apps/web/src/features/admin/lib/channel-slug-suggest.ts",
      ]),
    ).toEqual([]);
  });

  it("builds card page links only through cardPath and cardUrl", () => {
    expect(
      offenders(ALL_FILES, /`[^`]*(?<!media|api\/v1|API_BASE\})\/cards\/\$\{|"\/cards\/" *\+/u, [
        "packages/shared/src/site-paths.ts",
        "packages/shared/src/marketplace.ts",
      ]),
    ).toEqual([]);
  });

  it("builds marketplace SKU keys only through skuKey and marketplaceSkuKey", () => {
    expect(
      offenders(ALL_FILES, /\$\{[^}`]*externalId\}::\$\{[^}`]*finish\}::/u, [
        "packages/shared/src/marketplace-sku-key.ts",
      ]),
    ).toEqual([]);
  });

  it("picks a card's cheapest printing only through the shared card-price module", () => {
    expect(
      offenders(
        ALL_FILES,
        /cheapest\w*\s*===\s*undefined\s*\|\|\s*price\s*<|lowestPriceFor|cheapestPriceByCardId/u,
      ),
    ).toEqual([]);
  });

  it("formats money only through the shared formatters", () => {
    expect(offenders(ALL_FILES, /=== "EUR" \? formatPriceEur\(/u)).toEqual([]);
  });

  it("validates every search field leniently, so a stale link falls back to a default", () => {
    const routeFiles = WEB_FILES.filter((file) => path.relative(SRC, file).startsWith("routes/"));
    const schemaNames = new Set(
      routeFiles.flatMap((file) =>
        [
          ...readFileSync(file, "utf-8").matchAll(
            /validateSearch: (?:z\.extend\()?(?<schema>\w+)/gu,
          ),
        ].map((match) => match.groups?.schema ?? ""),
      ),
    );
    const schemaFiles = WEB_FILES.filter((file) => {
      const source = readFileSync(file, "utf-8");
      return [...schemaNames].some((name) =>
        new RegExp(String.raw`\bconst ${name}\b`, "u").test(source),
      );
    });
    expect(offenders([...routeFiles, ...schemaFiles], /^\s+\w+: z\.optional\(/mu)).toEqual([]);
  });

  it("flips an index sort only through nextIndexSort", () => {
    expect(
      offenders(WEB_FILES, /direction === "asc" \? "desc" : "asc"/u, [
        "apps/web/src/features/meta/lib/meta-index-sort.ts",
      ]),
    ).toEqual([]);
  });

  it("tags collection mutations only through mutationTag", () => {
    expect(
      offenders(WEB_FILES, /\bconst metadata = \{\};/u, ["apps/web/src/lib/mutation-metadata.ts"]),
    ).toEqual([]);
  });

  it("rasterizes elements only through html-capture", () => {
    expect(
      offenders(
        WEB_FILES,
        /function (?:resolveClipPaths|waitForRender)\b|from "html2canvas-pro"/u,
        ["apps/web/src/lib/html-capture.ts"],
      ),
    ).toEqual([]);
  });

  it("splits a group stage into units in one place", () => {
    expect(
      offenders(ALL_FILES, /function (?:podsOfUnit|pairUnits)\b/u, [
        "packages/shared/src/pairing/group-stage.ts",
      ]),
    ).toEqual([]);
  });
});

describe("generic helpers", () => {
  it("memoizes through the React Compiler, keeping memo only on virtualized cells", () => {
    expect(
      offenders(WEB_FILES, /\b(?:useMemo|useCallback)\(|\bmemo\(/u, [
        "apps/web/src/features/cards/components/card-grid.tsx",
        "apps/web/src/features/cards/components/card-table.tsx",
        "apps/web/src/features/cards/components/browser-card-cell.tsx",
        "apps/web/src/features/cards/components/card-thumbnail.tsx",
        "apps/web/src/features/collections/components/collection-grid-cell.tsx",
        "apps/web/src/features/lists/components/list-grid-cell.tsx",
        "apps/web/src/components/ui/chart.tsx",
        "apps/web/src/components/ui/drawer.tsx",
        "apps/web/src/components/ui/field.tsx",
        "apps/web/src/components/ui/sidebar.tsx",
      ]),
    ).toEqual([]);
  });

  it("reads thrown errors only through the shared error helpers", () => {
    expect(
      offenders(
        ALL_FILES,
        /instanceof Error \? \w+\.message\b|instanceof Error \? \w+ : new Error\(/u,
        ["packages/shared/src/strings.ts", "apps/web/src/lib/error-text.ts"],
      ),
    ).toEqual([]);
  });

  it("splits arrays only through chunk", () => {
    expect(
      offenders(
        ALL_FILES,
        /for \(let (?<step>\w+) = 0; \k<step> < [\w.]+\.length; \k<step> \+= [A-Z][A-Z_]*\)/u,
        [
          "packages/shared/src/collections.ts",
          "apps/web/src/features/admin/hooks/use-admin-image-mutations.ts",
        ],
      ),
    ).toEqual([]);
  });

  it("defines clamp and sleep once", () => {
    expect(
      offenders(ALL_FILES, /function clamp\(|setTimeout\(resolve, \w+\)/u, [
        "packages/shared/src/math.ts",
        "packages/shared/src/async.ts",
        // A timeout raced against a shutdown, cleared on either outcome.
        "packages/shared/src/otel/tracing-node.ts",
      ]),
    ).toEqual([]);
  });

  it("rounds card corners through the card radius token", () => {
    expect(
      offenders(WEB_FILES, /5% ?\/ ?3\.6%/u, [
        "apps/web/src/features/cards/lib/card-grid-constants.ts",
        "apps/web/src/features/cards/components/card-detail/card-image.tsx",
      ]),
    ).toEqual([]);
  });
});

describe("mutations and jobs", () => {
  const parse = (file: string) => {
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return ts.createSourceFile(
      file,
      readFileSync(file, "utf-8"),
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
  };

  it("names job kinds only through the shared job-run-kinds constants", async () => {
    const { JOB_KIND, META_JOB_KINDS } = await import("@openrift/shared/job-run-kinds");
    const kinds = new Set<string>([...Object.values(JOB_KIND), ...META_JOB_KINDS]);
    const literalKinds = (file: string) => {
      const found: string[] = [];
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          kinds.has(node.text)
        ) {
          found.push(`${relative(file)}: ${node.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(parse(file));
      return found;
    };
    expect(
      ALL_FILES.filter((file) => !file.endsWith("job-run-kinds.ts")).flatMap((file) =>
        literalKinds(file),
      ),
    ).toEqual([]);
  });

  it("shows admin table save errors inline only", () => {
    const missing = WEB_FILES.flatMap((file) => {
      const source = readFileSync(file, "utf-8");
      const names = [
        ...source.matchAll(/onSave: \([^)]*\) =>\s*(?:\{\s*return\s+)?(?<name>\w+)\.mutateAsync/gu),
      ].map((match) => match.groups?.name ?? "");
      return names
        .filter(
          (name) =>
            !new RegExp(String.raw`const ${name} = use\w+\([^)]*inlineError: true`, "u").test(
              source,
            ),
        )
        .map((name) => `${relative(file)}: ${name}`);
    });
    expect(missing).toEqual([]);
  });

  it("awaits mutations only through runReportedMutation", () => {
    const handwritten = (file: string) => {
      const found: string[] = [];
      const at = (node: ts.Node, what: string) => {
        const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
        found.push(`${relative(file)}:${line + 1} ${what}`);
      };
      const visit = (node: ts.Node) => {
        if (ts.isTryStatement(node) && node.tryBlock.getText().includes(".mutateAsync")) {
          at(node, "try around mutateAsync");
        }
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          (node.expression.name.text === "catch" ||
            (node.expression.name.text === "then" && node.arguments.length > 1)) &&
          node.expression.expression.getText().includes(".mutateAsync(")
        ) {
          at(node, `.${node.expression.name.text}() on mutateAsync`);
        }
        ts.forEachChild(node, visit);
      };
      const sf = parse(file);
      visit(sf);
      if (sf.text.includes("Reported by the global mutation")) {
        found.push(`${relative(file)} comment-only mutation catch`);
      }
      return found;
    };
    expect(
      WEB_FILES.filter((file) => !file.endsWith("run-reported-mutation.ts")).flatMap((file) =>
        handwritten(file),
      ),
    ).toEqual([]);
  });
});

describe("admin display", () => {
  const adminFiles = WEB_FILES.filter((file) =>
    ["apps/web/src/features/admin/", "apps/web/src/features/catalog-workspace/"].some((dir) =>
      relative(file).startsWith(dir),
    ),
  );
  const admin = (file: string) => `apps/web/src/features/admin/${file}`;

  it("shows admin instants in UTC", () => {
    expect(
      offenders(
        adminFiles,
        /\b(?:formatDayTimeLocal|formatDayLocal|formatTimeLocal|formatWeekday\w*Local|dateLeafParts)\(/u,
      ),
    ).toEqual([]);
    expect(offenders(ALL_FILES, /format(?:Day|DayTime|Month)\([^)]*\)\.slice\(/u)).toEqual([]);
  });

  it("tests field emptiness only through hasFieldValue", () => {
    expect(
      offenders(
        adminFiles,
        /(?<name>\w+) === null \|\| \k<name> === undefined \|\| \k<name> === ""/u,
        [admin("components/new-printing-group-card.tsx")],
      ),
    ).toEqual([]);
  });

  it("parses admin number inputs only through parseIntegerInput", () => {
    expect(
      offenders(adminFiles, /Number\.parseInt\(|parseFloat\(|function parseNum\b|\/\^\\d\+\$\/u/u),
    ).toEqual([]);
  });

  it("renders admin values only through field-value-text", () => {
    expect(
      offenders(
        adminFiles,
        /JSON\.stringify\(field\.(?:from|to)\)|function (?:formatValue|formatRecordValue|formatSuggestionValue|historySummary|newestFirst|hasValue|candidateHasValue|isValidFieldOption)\b/u,
        ["apps/web/src/features/catalog-workspace/lib/card-record-summaries.ts"],
      ),
    ).toEqual([]);
  });

  it("formats admin counts through formatCount", () => {
    expect(offenders(adminFiles, /\.toLocaleString\(\)/u)).toEqual([]);
  });

  it("selects admin rows only through the row selection store", () => {
    expect(
      offenders(adminFiles, /\[\w*[sS]elected\w*, set\w*\] = useState<(?:Readonly)?Set</u),
    ).toEqual([]);
  });

  it("builds admin tables through AdminTable", () => {
    expect(
      offenders(adminFiles, /from "@\/components\/ui\/table"|<table\b/u, [
        admin("components/admin-table.tsx"),
        admin("components/admin-table-group-row.tsx"),
        admin("components/admin-table-reorder-row.tsx"),
        admin("components/upload-preview-tables.tsx"),
        admin("components/meta-review-event-group.tsx"),
        admin("components/meta-review-player-row.tsx"),
        admin("components/meta-archive-jobs-card.tsx"),
        admin("components/unmatched-products-panel.tsx"),
        admin("components/candidate-spreadsheet.tsx"),
        admin("components/design/ui/data-section.tsx"),
      ]),
    ).toEqual([]);
  });
});
