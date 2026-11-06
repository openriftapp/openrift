import { matchesTextQuery } from "@openrift/shared/search-fold";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { Badge } from "@/components/ui/badge";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Field, FieldLabel } from "@/components/ui/field";
import { PrintingDeskMarkerBrowser } from "@/features/admin/components/printing-desk-marker-browser";
import { useCreateMarker, useMarkers } from "@/features/admin/hooks/use-markers";
import { slugifyLabel } from "@/features/admin/lib/channel-slug-suggest";

export function PrintingDeskMarkerPicker({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (slugs: string[]) => void;
}) {
  const { data } = useMarkers();
  const createMarker = useCreateMarker();
  const [query, setQuery] = useState("");

  const labelBySlug = new Map(data.markers.map((marker) => [marker.slug, marker.label]));
  const descriptionBySlug = new Map(
    data.markers.map((marker) => [marker.slug, marker.description]),
  );
  const results = data.markers.filter(
    (marker) =>
      !value.includes(marker.slug) && matchesTextQuery(query, [marker.label, marker.slug]),
  );

  function existsFor(typed: string) {
    const needle = typed.trim().toLowerCase();
    return data.markers.some(
      (marker) => marker.label.toLowerCase() === needle || marker.slug === slugifyLabel(typed),
    );
  }

  function add(slug: string) {
    setQuery("");
    if (!value.includes(slug)) {
      onChange([...value, slug]);
    }
  }

  function toggle(slug: string) {
    if (value.includes(slug)) {
      onChange(value.filter((entry) => entry !== slug));
      return;
    }
    onChange([...value, slug]);
  }

  async function createAndAdd(typed: string) {
    const slug = slugifyLabel(typed);
    if (slug.length === 0) {
      return;
    }
    await createMarker.mutateAsync({ slug, label: typed.trim() });
    add(slug);
  }

  return (
    <Field>
      <FieldLabel htmlFor="desk-marker-search">Printed on the card</FieldLabel>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((slug) => (
            <Badge key={slug} variant="secondary">
              {labelBySlug.get(slug) ?? slug}
              <ChipRemoveButton
                aria-label={`Remove ${labelBySlug.get(slug) ?? slug}`}
                onClick={() => onChange(value.filter((entry) => entry !== slug))}
              />
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <ComboboxPicker
          trigger="input"
          id="desk-marker-search"
          className="min-w-0 flex-1"
          placeholder="Stamp, signature, promo mark…"
          options={results.map((marker) => ({ value: marker.slug, label: marker.label }))}
          renderOption={(option) => {
            const description = descriptionBySlug.get(option.value);
            return (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {description && (
                    <span className="text-muted-foreground block text-xs">{description}</span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {option.value}
                </span>
              </>
            );
          }}
          filter="none"
          query={query}
          onQueryChange={setQuery}
          value={null}
          onChange={(slug) => {
            if (slug !== null) {
              add(slug);
            }
          }}
          clearOnSelect
          emptyText="No matching markers."
          actions={[
            {
              key: "create",
              label: (typed) => (
                <span className="text-primary flex items-center gap-1.5">
                  <PlusIcon className="size-3.5" />
                  Add “{typed.trim()}”
                </span>
              ),
              visible: (typed) => typed.trim().length > 0 && !existsFor(typed),
              disabled: createMarker.isPending,
              onSelect: (typed) => void createAndAdd(typed),
            },
          ]}
        />
        <PrintingDeskMarkerBrowser markers={data.markers} selected={value} onToggle={toggle} />
      </div>
    </Field>
  );
}
