import type { DeckResponse } from "@openrift/shared/types/api/deck";
import { capitalize } from "@openrift/shared/utils";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { useFilterActions } from "@/features/cards/hooks/use-card-filters";
import { getFormatTagConfig } from "@/features/collections/lib/format-tag-config";
import {
  TagMultiSelect,
  useCategoryTagSlugs,
} from "@/features/decks/components/format-tag-multi-select";
import { useUpdateDeckMeta } from "@/features/decks/hooks/use-decks";

/**
 * Switching INTO a tag-locked format from the action menu clears
 * `formatConfig` server-side, so existing decks land here too.
 */
export function FormatTagPickBanner({ deck }: { deck: DeckResponse }) {
  const config = getFormatTagConfig(deck.format);
  const availableSlugs = useCategoryTagSlugs(config?.category ?? "");
  const { update: updateDeckMeta, isPending } = useUpdateDeckMeta(deck.id);
  const { setArrayFilter } = useFilterActions();
  const [selected, setSelected] = useState<string[]>([]);

  if (!config) {
    return null;
  }

  if (availableSlugs.length === 0) {
    return (
      <Alert variant="warning">
        <AlertTitle>No {config.nounPlural} available</AlertTitle>
        <AlertDescription>
          An admin needs to create at least one custom tag in the <code>{config.category}</code>{" "}
          category before this format can be built.
        </AlertDescription>
      </Alert>
    );
  }

  const handleConfirm = () => {
    updateDeckMeta(
      { formatConfig: { tagSlugs: selected } },
      {
        // Seeds the Custom Tags filter so the user lands in the builder with
        // only legal cards visible.
        onSuccess: () => setArrayFilter("customTags", selected),
      },
    );
  };

  return (
    <Callout className="space-y-4">
      <div>
        <Heading level={2}>Pick one or more {config.nounPlural}</Heading>
        <p className="text-muted-foreground text-sm">
          Every card must carry one of the chosen {config.nounPlural}. You can change them later
          from the deck menu.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="format-tag-picker">{capitalize(config.nounPlural)}</Label>
        <TagMultiSelect
          triggerId="format-tag-picker"
          category={config.category}
          nounPlural={config.nounPlural}
          selected={selected}
          onChange={setSelected}
        />
      </div>
      <Button disabled={selected.length === 0 || isPending} onClick={handleConfirm}>
        {isPending
          ? "Saving…"
          : `Start building${selected.length > 1 ? ` (${selected.length} ${config.nounPlural})` : ""}`}
      </Button>
    </Callout>
  );
}

export function needsFormatTagPick(deck: Pick<DeckResponse, "format" | "formatConfig">): boolean {
  if (getFormatTagConfig(deck.format) === null) {
    return false;
  }
  return (deck.formatConfig?.tagSlugs ?? []).length === 0;
}
