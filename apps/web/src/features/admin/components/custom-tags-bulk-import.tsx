import { pluralize } from "@openrift/shared/strings";
import type { CustomTagResponse } from "@openrift/shared/types/api/admin";
import { useState } from "react";

import { Disclosure } from "@/components/disclosure";
import {
  SectionHeader,
  SectionHeaderDescription,
  SectionHeaderGroup,
  SectionHeaderTitle,
} from "@/components/section-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAllCards } from "@/features/admin/hooks/use-admin-card-queries";
import { useAddCardsToCustomTag } from "@/features/collections/hooks/use-custom-tags";
import type { BulkImportPlan } from "@/features/collections/lib/custom-tag-bulk-import";
import { planCustomTagBulkImport } from "@/features/collections/lib/custom-tag-bulk-import";

export function BulkImport({ tags }: { tags: CustomTagResponse[] }) {
  const { data: allCards } = useAllCards();
  const mutation = useAddCardsToCustomTag();
  const [tagId, setTagId] = useState<string>(tags[0]?.id ?? "");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    added: number;
    matched: number;
    tagLabel: string;
  } | null>(null);

  const plan: BulkImportPlan = planCustomTagBulkImport(text, allCards);

  const selectedTag = tags.find((t) => t.id === tagId);
  const canImport = selectedTag !== undefined && plan.cardIds.length > 0;

  const tagsByCategory = Map.groupBy(tags, (t) => t.categoryLabel);
  const tagItems = tags.map((tag) => ({ value: tag.id, label: tag.label }));

  async function handleImport() {
    if (!selectedTag) {
      return;
    }
    const matchedCount = plan.cardIds.length;
    try {
      const response = await mutation.mutateAsync({ tagId: selectedTag.id, cardIds: plan.cardIds });
      setResult({ added: response.added, matched: matchedCount, tagLabel: selectedTag.label });
      setText("");
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      <SectionHeader>
        <SectionHeaderGroup>
          <SectionHeaderTitle as="h3">Bulk import</SectionHeaderTitle>
          <SectionHeaderDescription>
            Paste a decklist or an exported list (one card per line, optionally prefixed by a count
            like 3 or 3x) and attach the selected tag to every matched card. Re-importing is safe —
            cards already carrying the tag are left untouched.
          </SectionHeaderDescription>
        </SectionHeaderGroup>
      </SectionHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="bulk-import-tag">Tag</Label>
          <Select
            items={tagItems}
            value={tagId}
            onValueChange={(next) => {
              if (next !== null) {
                setTagId(next);
                setResult(null);
              }
            }}
          >
            <SelectTrigger id="bulk-import-tag" className="h-8 w-40" aria-label="Tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...tagsByCategory.entries()].map(([categoryLabel, group]) => (
                <SelectGroup key={categoryLabel}>
                  <SelectLabel>{categoryLabel}</SelectLabel>
                  {group.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="bulk-import-text">Cards</Label>
        <Textarea
          id="bulk-import-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={"1 Brazen Buccaneer\n1 Riptide Rex\n1 Bilgewater Bully"}
          rows={10}
          className="font-mono text-sm"
        />
      </div>

      <BulkImportPreview plan={plan} />

      <div className="flex items-center gap-3">
        <Button
          disabled={!canImport}
          pending={mutation.isPending}
          onClick={() => void handleImport()}
        >
          Import {plan.cardIds.length} {pluralize(plan.cardIds.length, "card")}
        </Button>
        {result && (
          <p className="text-sm">
            Added <span className="font-semibold">{result.added}</span> of {result.matched} matched
            {pluralize(result.matched, "card")} to{" "}
            <span className="font-semibold">{result.tagLabel}</span>
            {result.added < result.matched && (
              <span className="text-muted-foreground">
                {" "}
                ({result.matched - result.added} already tagged)
              </span>
            )}
            .
          </p>
        )}
      </div>
    </section>
  );
}

function BulkImportPreview({ plan }: { plan: BulkImportPlan }) {
  if (
    plan.matched.length === 0 &&
    plan.unmatched.length === 0 &&
    plan.ambiguous.length === 0 &&
    plan.warnings.length === 0
  ) {
    return null;
  }
  return (
    <div className="space-y-2 text-sm">
      <p>
        Matched <span className="font-semibold">{plan.matched.length}</span>{" "}
        {pluralize(plan.matched.length, "card")}.
      </p>
      {plan.unmatched.length > 0 && (
        <Disclosure
          variant="plain"
          title={`Unmatched: ${plan.unmatched.length} ${pluralize(plan.unmatched.length, "name")}`}
          className="text-muted-foreground"
        >
          <ul className="list-disc pl-5">
            {plan.unmatched.map((name, i) => (
              <li key={`${name}-${i}`} className="font-mono">
                {name}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {plan.ambiguous.length > 0 && (
        <Disclosure
          variant="plain"
          title={`Ambiguous: ${plan.ambiguous.length} ${pluralize(plan.ambiguous.length, "name")} (skipped)`}
          className="text-muted-foreground"
        >
          <ul className="list-disc pl-5">
            {plan.ambiguous.map((a, i) => (
              <li key={`${a.name}-${i}`} className="font-mono">
                {a.name} ({a.matches.length} matches)
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {plan.warnings.length > 0 && (
        <Disclosure
          variant="plain"
          title={`Skipped lines: ${plan.warnings.length}`}
          className="text-muted-foreground"
        >
          <ul className="list-disc pl-5">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
