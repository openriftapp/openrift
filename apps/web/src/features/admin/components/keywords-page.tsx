import { pluralize } from "@openrift/shared/strings";
import { WellKnown } from "@openrift/shared/well-known";
import { CircleXIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { PageDescription } from "@/components/layout/page-top-bar";
import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RowList, RowListItem } from "@/components/ui/row-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorInput, DraftTextInput } from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type {
  AdminCellSlotProps,
  AdminColumnDef,
  AdminDraftSlotProps,
} from "@/features/admin/components/admin-table";
import {
  useCreateKeywordStyle,
  useDeleteKeywordStyle,
  useDeleteTranslation,
  useDiscoverTranslations,
  useKeywordStats,
  useRecomputeKeywords,
  useUpdateKeywordStyle,
  useUpsertTranslation,
} from "@/features/admin/hooks/use-keywords";
import { useLanguageLabels } from "@/hooks/use-enums";

// Fallback badge color, matching getKeywordStyle's FALLBACK_COLOR. Used when a
// keyword with no style row is flagged as a cost keyword (which needs a row).
const FALLBACK_KEYWORD_COLOR = "#6a6a6a";

interface KeywordRow {
  keyword: string;
  count: number;
  color: string | null;
  darkText: boolean;
  costKeyword: boolean;
  cardModifier: boolean;
  translations: { language: string; label: string }[];
}

interface KeywordDraft {
  keyword: string;
  color: string;
  darkText: boolean;
  costKeyword: boolean;
  cardModifier: boolean;
}

interface TranslationRow {
  keywordName: string;
  language: string;
  label: string;
}

function KeywordCell({ row }: AdminCellSlotProps<KeywordRow>) {
  if (!row) {
    return null;
  }
  return <span className="font-medium">{row.keyword}</span>;
}

function CountCell({ row }: AdminCellSlotProps<KeywordRow>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono text-sm">{row.count}</span>;
}

function ColorCell({ row }: AdminCellSlotProps<KeywordRow>) {
  if (!row) {
    return null;
  }
  if (!row.color) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block size-4 rounded-md border"
        style={{ backgroundColor: row.color }}
      />
      <span className="font-mono text-sm">{row.color}</span>
    </div>
  );
}

function DarkTextCell({ row }: AdminCellSlotProps<KeywordRow>) {
  const updateStyle = useUpdateKeywordStyle();
  if (!row || !row.color) {
    return null;
  }
  const color = row.color;
  return (
    <Checkbox
      checked={row.darkText}
      onCheckedChange={(checked) =>
        updateStyle.mutate({
          name: row.keyword,
          color,
          darkText: checked,
          costKeyword: row.costKeyword,
          cardModifier: row.cardModifier,
        })
      }
    />
  );
}

function TranslationsCell({ row }: AdminCellSlotProps<KeywordRow>) {
  if (!row) {
    return null;
  }
  if (row.translations.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {row.translations.map((t) => (
        <span key={t.language} className="text-muted-foreground text-xs">
          {t.language}: {t.label}
        </span>
      ))}
    </div>
  );
}

function PreviewCell({ row }: AdminCellSlotProps<KeywordRow>) {
  if (!row) {
    return null;
  }
  return (
    <Badge
      style={
        row.color
          ? {
              backgroundColor: row.color,
              color: row.darkText ? "#1a1a1a" : "#ffffff",
            }
          : undefined
      }
      variant={row.color ? "default" : "secondary"}
    >
      {row.keyword}
    </Badge>
  );
}

function DarkTextInput({ draft, setDraft }: AdminDraftSlotProps<KeywordDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <Checkbox
      checked={draft.darkText}
      onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, darkText: checked }))}
    />
  );
}

function CostKeywordCell({ row }: AdminCellSlotProps<KeywordRow>) {
  const updateStyle = useUpdateKeywordStyle();
  if (!row) {
    return null;
  }
  // Toggling on a keyword with no style row still needs a row to hold the flag,
  // so fall back to the neutral badge color (keeps the rendered badge unchanged).
  return (
    <Checkbox
      checked={row.costKeyword}
      onCheckedChange={(checked) =>
        updateStyle.mutate({
          name: row.keyword,
          color: row.color ?? FALLBACK_KEYWORD_COLOR,
          darkText: row.darkText,
          costKeyword: checked,
          cardModifier: row.cardModifier,
        })
      }
    />
  );
}

function CostKeywordInput({ draft, setDraft }: AdminDraftSlotProps<KeywordDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <Checkbox
      checked={draft.costKeyword}
      onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, costKeyword: checked }))}
    />
  );
}

function CardModifierCell({ row }: AdminCellSlotProps<KeywordRow>) {
  const updateStyle = useUpdateKeywordStyle();
  if (!row) {
    return null;
  }
  return (
    <Checkbox
      checked={row.cardModifier}
      onCheckedChange={(checked) =>
        updateStyle.mutate({
          name: row.keyword,
          color: row.color ?? FALLBACK_KEYWORD_COLOR,
          darkText: row.darkText,
          costKeyword: row.costKeyword,
          cardModifier: checked,
        })
      }
    />
  );
}

function CardModifierInput({ draft, setDraft }: AdminDraftSlotProps<KeywordDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <Checkbox
      checked={draft.cardModifier}
      onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, cardModifier: checked }))}
    />
  );
}

const columns: AdminColumnDef<KeywordRow, KeywordDraft>[] = [
  {
    header: "Keyword",
    sortValue: (row) => row.keyword,
    cell: <KeywordCell />,
    addCell: (
      <DraftTextInput<KeywordDraft> field="keyword" placeholder="Keyword name" className="w-40" />
    ),
  },
  {
    header: "Cards",
    align: "right",
    sortValue: (row) => row.count,
    cell: <CountCell />,
  },
  {
    header: "Color",
    cell: <ColorCell />,
    editCell: <ColorInput<KeywordDraft> placeholder="#6366f1" />,
    addCell: <ColorInput<KeywordDraft> placeholder="#6366f1" />,
  },
  {
    header: "Dark text",
    align: "center",
    cell: <DarkTextCell />,
    editCell: <DarkTextInput />,
    addCell: <DarkTextInput />,
  },
  {
    header: "Cost keyword",
    align: "center",
    cell: <CostKeywordCell />,
    editCell: <CostKeywordInput />,
    addCell: <CostKeywordInput />,
  },
  {
    header: "Card modifier",
    align: "center",
    cell: <CardModifierCell />,
    editCell: <CardModifierInput />,
    addCell: <CardModifierInput />,
  },
  {
    header: "Translations",
    cell: <TranslationsCell />,
  },
  {
    header: "Preview",
    cell: <PreviewCell />,
  },
];

export function KeywordsPage() {
  const { data } = useKeywordStats();
  const recomputeKeywords = useRecomputeKeywords();
  const discoverTranslations = useDiscoverTranslations();
  const updateStyle = useUpdateKeywordStyle();
  const deleteStyle = useDeleteKeywordStyle();
  const createStyle = useCreateKeywordStyle();

  const styleMap = new Map(data.styles.map((s) => [s.name, s]));
  const translationsByKeyword = Map.groupBy(data.translations, (t) => t.keywordName);

  const rows: KeywordRow[] = [
    ...data.counts.map((c) => {
      const style = styleMap.get(c.keyword);
      return {
        keyword: c.keyword,
        count: c.count,
        color: style?.color ?? null,
        darkText: style?.darkText ?? false,
        costKeyword: style?.costKeyword ?? false,
        cardModifier: style?.cardModifier ?? false,
        translations: translationsByKeyword.get(c.keyword) ?? [],
      };
    }),
    ...data.styles
      .filter((s) => !data.counts.some((c) => c.keyword === s.name))
      .map((s) => ({
        keyword: s.name,
        count: 0,
        color: s.color,
        darkText: s.darkText,
        costKeyword: s.costKeyword,
        cardModifier: s.cardModifier,
        translations: translationsByKeyword.get(s.name) ?? [],
      })),
  ];

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection title="Maintenance">
        <SettingsRow
          label="Recompute keywords"
          description="Re-extract keywords from all card and printing text fields"
        >
          {recomputeKeywords.isSuccess && (
            <p className="text-muted-foreground text-sm">
              Updated {recomputeKeywords.data.updated} of {recomputeKeywords.data.totalCards} cards
            </p>
          )}
          {recomputeKeywords.isError && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CircleXIcon className="text-destructive size-4 shrink-0" />
              Failed
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => recomputeKeywords.mutate()}
            pending={recomputeKeywords.isPending}
          >
            Recompute
          </Button>
        </SettingsRow>

        <SettingsRow
          label="Auto-discover translations"
          description="Correlate EN and non-EN printings to find keyword translations"
        >
          {discoverTranslations.isSuccess && (
            <p className="text-muted-foreground text-sm">
              Found {discoverTranslations.data.discovered.length}, inserted{" "}
              {discoverTranslations.data.inserted}
              {discoverTranslations.data.conflicts.length > 0 &&
                `, ${discoverTranslations.data.conflicts.length} ${pluralize(discoverTranslations.data.conflicts.length, "conflict")}`}
            </p>
          )}
          {discoverTranslations.isError && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CircleXIcon className="text-destructive size-4 shrink-0" />
              Failed
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => discoverTranslations.mutate()}
            pending={discoverTranslations.isPending}
          >
            Discover
          </Button>
        </SettingsRow>
      </SettingsSection>

      {discoverTranslations.isSuccess && discoverTranslations.data.conflicts.length > 0 && (
        <SettingsSection title="Translation conflicts (needs manual review)">
          <RowList className="text-sm">
            {discoverTranslations.data.conflicts.map((conflict) => (
              <RowListItem key={`${conflict.keyword}-${conflict.language}`}>
                <span>
                  <span className="font-medium">{conflict.keyword}</span> ({conflict.language}):{" "}
                  {conflict.labels.join(" / ")}
                </span>
              </RowListItem>
            ))}
          </RowList>
        </SettingsSection>
      )}

      <AdminTable
        columns={columns}
        data={rows}
        getRowKey={(row) => row.keyword}
        defaultSort={{ column: "Cards", direction: "desc" }}
        emptyText="No keywords found. Try running recompute first."
        topBar={(actions) => <AdminPageTopBar title="Keywords" actions={actions} />}
        toolbar={
          <PageDescription>
            Keywords extracted from card and printing text. Styles control how keyword badges
            appear.
          </PageDescription>
        }
        add={{
          emptyDraft: {
            keyword: "",
            color: "#6366f1",
            darkText: false,
            costKeyword: false,
            cardModifier: false,
          },
          onSave: (draft) =>
            createStyle.mutateAsync({
              name: draft.keyword.trim(),
              color: draft.color,
              darkText: draft.darkText,
              costKeyword: draft.costKeyword,
              cardModifier: draft.cardModifier,
            }),
          validate: (draft) => {
            const name = draft.keyword.trim();
            if (!name) {
              return "Keyword name is required";
            }
            if (data.styles.some((s) => s.name === name)) {
              return "Style already exists for this keyword";
            }
            return null;
          },
          label: "Add Style",
        }}
        edit={{
          toDraft: (row) => ({
            keyword: row.keyword,
            color: row.color ?? "#707070",
            darkText: row.darkText,
            costKeyword: row.costKeyword,
            cardModifier: row.cardModifier,
          }),
          onSave: (draft) =>
            updateStyle.mutateAsync({
              name: draft.keyword,
              color: draft.color,
              darkText: draft.darkText,
              costKeyword: draft.costKeyword,
              cardModifier: draft.cardModifier,
            }),
        }}
        delete={{
          onDelete: (row) => deleteStyle.mutateAsync(row.keyword),
          confirm: (row) => ({
            title: `Delete style for "${row.keyword}"?`,
            description: "The keyword will still appear on cards but without custom styling.",
          }),
        }}
      />

      <TranslationsTable
        translations={data.translations}
        keywordNames={data.styles.map((s) => s.name)}
        languageLabels={useLanguageLabels()}
      />
    </div>
  );
}

function TranslationKeywordCell({ row }: AdminCellSlotProps<TranslationRow>) {
  if (!row) {
    return null;
  }
  return <span className="font-medium">{row.keywordName}</span>;
}

function TranslationLanguageCell({ row }: AdminCellSlotProps<TranslationRow>) {
  return row ? row.language : null;
}

function TranslationLabelCell({ row }: AdminCellSlotProps<TranslationRow>) {
  return row ? row.label : null;
}

function TranslationKeywordSelect({
  draft,
  setDraft,
  keywordNames,
}: AdminDraftSlotProps<TranslationRow> & { keywordNames: string[] }) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <Select
      value={draft.keywordName}
      onValueChange={(value) => setDraft((prev) => ({ ...prev, keywordName: value ?? "" }))}
    >
      <SelectTrigger className="h-8 w-40" aria-label="Keyword">
        <SelectValue placeholder="Keyword" />
      </SelectTrigger>
      <SelectContent>
        {keywordNames.toSorted().map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TranslationLanguageSelect({
  draft,
  setDraft,
  languageLabels,
}: AdminDraftSlotProps<TranslationRow> & { languageLabels: Record<string, string> }) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <Select
      value={draft.language}
      onValueChange={(value) => setDraft((prev) => ({ ...prev, language: value ?? "" }))}
    >
      <SelectTrigger className="h-8 w-28" aria-label="Language">
        <SelectValue placeholder="Language">
          {(value: string) => `${value} — ${languageLabels[value] ?? value}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(languageLabels)
          .filter(([code]) => code !== WellKnown.language.EN)
          .map(([code, name]) => (
            <SelectItem key={code} value={code}>
              {code} — {name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function validateTranslation(draft: TranslationRow): string | null {
  if (!draft.keywordName.trim() || !draft.language.trim() || !draft.label.trim()) {
    return "Keyword, language and translation are required";
  }
  return null;
}

function TranslationsTable({
  translations,
  keywordNames,
  languageLabels,
}: {
  translations: TranslationRow[];
  keywordNames: string[];
  languageLabels: Record<string, string>;
}) {
  const upsertTranslation = useUpsertTranslation();
  const deleteTranslation = useDeleteTranslation();

  const translationColumns: AdminColumnDef<TranslationRow>[] = [
    {
      header: "Keyword",
      cell: <TranslationKeywordCell />,
      addCell: <TranslationKeywordSelect keywordNames={keywordNames} />,
    },
    {
      header: "Language",
      cell: <TranslationLanguageCell />,
      addCell: <TranslationLanguageSelect languageLabels={languageLabels} />,
    },
    {
      header: "Translation",
      cell: <TranslationLabelCell />,
      editCell: <DraftTextInput<TranslationRow> field="label" className="w-40" />,
      addCell: (
        <DraftTextInput<TranslationRow> field="label" placeholder="Translation" className="w-40" />
      ),
    },
  ];

  function saveTranslation(draft: TranslationRow) {
    return upsertTranslation.mutateAsync({
      keywordName: draft.keywordName.trim(),
      language: draft.language.trim(),
      label: draft.label.trim(),
    });
  }

  return (
    <AdminTable
      columns={translationColumns}
      data={translations}
      getRowKey={(t) => `${t.keywordName}-${t.language}`}
      emptyText="No translations yet. Try running auto-discover."
      toolbar={<Heading level={2}>Keyword Translations</Heading>}
      add={{
        emptyDraft: { keywordName: "", language: "", label: "" },
        onSave: saveTranslation,
        validate: validateTranslation,
        label: "Add Translation",
      }}
      edit={{
        toDraft: (row) => ({ ...row }),
        onSave: saveTranslation,
        validate: validateTranslation,
      }}
      delete={{
        onDelete: (row) =>
          deleteTranslation.mutateAsync({ keywordName: row.keywordName, language: row.language }),
      }}
    />
  );
}
