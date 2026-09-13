import { ParaglideMessage } from "@inlang/paraglide-js-react";
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
import { m } from "@/paraglide/messages.js";

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
        <AlertTitle>
          {m.decks_format_tag_none_available({ nounPlural: config.nounPlural })}
        </AlertTitle>
        <AlertDescription>
          <ParaglideMessage
            message={m.decks_format_tag_none_available_body}
            inputs={{ category: config.category }}
            markup={{ code: ({ children }) => <code>{children}</code> }}
          />
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
        <Heading level={2}>
          {m.decks_format_tag_pick_heading({ nounPlural: config.nounPlural })}
        </Heading>
        <p className="text-muted-foreground text-sm">
          {m.decks_format_tag_pick_description({ nounPlural: config.nounPlural })}
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
          ? m.common_saving()
          : selected.length > 1
            ? m.decks_format_tag_start_building_count({
                count: selected.length,
                nounPlural: config.nounPlural,
              })
            : m.decks_format_tag_start_building()}
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
