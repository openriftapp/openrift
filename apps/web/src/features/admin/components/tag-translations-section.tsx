import { matchesTextQuery } from "@openrift/shared/search-fold";
import type { ClassifiedCardTag } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { LanguageChip } from "@/components/language-chip";
import { PageDescription } from "@/components/layout/page-top-bar";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Toggle } from "@/components/ui/toggle";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import {
  useDiscoverTagTranslations,
  useRemoveTagTranslation,
  useSetTagTranslation,
  useTagTranslations,
} from "@/features/cards/hooks/use-card-tags";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const NOT_MAPPED = "__not-mapped";

interface LabelRow {
  key: string;
  language: string;
  label: string;
  tag: string | null;
  cardCount: number | null;
}

function LanguageCell({ row }: AdminCellSlotProps<LabelRow>) {
  return row ? <LanguageChip code={row.language} /> : null;
}

function WaitingCell({ row }: AdminCellSlotProps<LabelRow>) {
  if (!row || row.cardCount === null) {
    return null;
  }
  return <span className="text-muted-foreground">{row.cardCount}</span>;
}

function TagSelectCell({
  row,
  items,
  onChange,
}: AdminCellSlotProps<LabelRow> & {
  items: { value: string; label: string }[];
  onChange?: (row: LabelRow, tag: string | null) => void;
}) {
  if (!row) {
    return null;
  }
  return (
    <SimpleSelect
      items={items}
      value={row.tag ?? NOT_MAPPED}
      onChange={(next) => onChange?.(row, next === NOT_MAPPED ? null : next)}
      label={`English tag for ${row.label}`}
      size="sm"
      className="w-52"
    />
  );
}

export function TagTranslationsSection({ tags }: { tags: ClassifiedCardTag[] }) {
  const { data } = useTagTranslations();
  const setTranslation = useSetTagTranslation();
  const removeTranslation = useRemoveTagTranslation();
  const discover = useDiscoverTagTranslations();
  const [filter, setFilter] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const rows: LabelRow[] = [
    ...data.unmapped.map((entry) => ({
      key: `${entry.language}:${entry.label}`,
      language: entry.language,
      label: entry.label,
      tag: null,
      cardCount: entry.cardCount,
    })),
    ...data.translations.map((entry) => ({
      key: `${entry.language}:${entry.label}`,
      language: entry.language,
      label: entry.label,
      tag: entry.tag,
      cardCount: null,
    })),
  ];
  const visible = rows
    .filter((row) => matchesTextQuery(filter, [row.label, row.tag ?? ""]))
    .filter((row) => !unmappedOnly || row.tag === null);

  const tagItems = [
    { value: NOT_MAPPED, label: "Not mapped" },
    ...tags
      .filter((tag) => tag.cardCount > 0)
      .map((tag) => ({ value: tag.tag, label: tag.tag }))
      .toSorted((a, b) => a.label.localeCompare(b.label)),
  ];

  const runDiscovery = async () => {
    let outcome: Awaited<ReturnType<typeof discover.mutateAsync>> | undefined;
    const ok = await runReportedMutation(async () => {
      outcome = await discover.mutateAsync();
    });
    if (!ok || !outcome) {
      return;
    }
    const conflicts =
      outcome.conflicts.length === 0
        ? ""
        : ` ${outcome.conflicts.length} unclear: ${outcome.conflicts
            .map((conflict) => `${conflict.label} (${conflict.tags.join(" or ")})`)
            .join(", ")}.`;
    setResult(`Added ${outcome.inserted} of ${outcome.discovered} found.${conflicts}`);
  };

  const columns: AdminColumnDef<LabelRow, never>[] = [
    { header: "Source label", sortValue: (row) => row.label, cell: <LabelCell /> },
    { header: "Language", width: "w-24", sortValue: (row) => row.language, cell: <LanguageCell /> },
    {
      header: "Cards waiting",
      width: "w-32",
      align: "right",
      sortValue: (row) => row.cardCount ?? 0,
      sortFirst: "desc",
      cell: <WaitingCell />,
    },
    {
      header: "English tag",
      sortValue: (row) => row.tag ?? "",
      cell: (
        <TagSelectCell
          items={tagItems}
          onChange={(row, tag) => {
            if (tag === null) {
              removeTranslation.mutate({ language: row.language, label: row.label });
            } else {
              setTranslation.mutate({ language: row.language, label: row.label, tag });
            }
          }}
        />
      ),
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={visible}
      getRowKey={(row) => row.key}
      emptyText={
        rows.length === 0 ? "No source uses a tag label in another language." : "No label matches."
      }
      toolbar={
        <div className="space-y-3">
          <PageDescription>
            Sources in other languages name tags in their own language. Each label is mapped to the
            English tag here before a source is compared with a card. A source row with an unmapped
            label makes no tag suggestion.
          </PageDescription>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={filter}
              onValueChange={setFilter}
              placeholder="Filter labels…"
              className="w-56"
            />
            <Toggle
              variant="outline"
              pressed={unmappedOnly}
              onPressedChange={setUnmappedOnly}
              aria-label="Show unmapped labels only"
            >
              Unmapped only ({data.unmapped.length})
            </Toggle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runDiscovery()}
              pending={discover.isPending}
              title="Pair each label with the English tag in the same position on the card"
            >
              Find translations
            </Button>
            {result && <span className="text-muted-foreground text-sm">{result}</span>}
          </div>
        </div>
      }
    />
  );
}

function LabelCell({ row }: AdminCellSlotProps<LabelRow>) {
  return row ? <span>{row.label}</span> : null;
}
