import type { DistributionChannelResponse } from "@openrift/shared/types/api/admin";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { PrintingDeskChannelBrowser } from "@/features/admin/components/printing-desk-channel-browser";
import {
  useCreateDistributionChannel,
  useDistributionChannels,
} from "@/features/admin/hooks/use-distribution-channels";
import type { ChannelSearchOption } from "@/features/admin/lib/channel-picker-search";
import { searchChannelOptions } from "@/features/admin/lib/channel-picker-search";
import { slugifyLabel, suggestChannelSlug } from "@/features/admin/lib/channel-slug-suggest";
import { buildChannelTree, leafChannels } from "@/features/cards/lib/distribution-channel-tree";

type Channel = DistributionChannelResponse;

function channelSearchOptions(channels: readonly Channel[]): ChannelSearchOption[] {
  const tree = buildChannelTree([...channels]);
  return leafChannels(tree).map((node) => ({
    id: node.channel.id,
    slug: node.channel.slug,
    label: node.channel.label,
    breadcrumb: node.breadcrumb,
    parentId: node.channel.parentId,
  }));
}

type Draft = { kind: "leaf"; label: string; parentId: string } | { kind: "root"; label: string };

export function PrintingDeskChannelPicker({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (slugs: string[]) => void;
}) {
  const { data } = useDistributionChannels();
  const channels = data.distributionChannels;
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const options = channelSearchOptions(channels);
  const bySlug = new Map(options.map((option) => [option.slug, option]));
  const results = searchChannelOptions(options, query).filter(
    (option) => !value.includes(option.slug),
  );
  const parents = channels.filter((channel) => channel.childrenLabel !== null);
  const suggestedParentId = results.at(0)?.parentId ?? parents.at(0)?.id ?? null;
  const suggestedParentLabel =
    channels.find((channel) => channel.id === suggestedParentId)?.label ?? "a series";

  function add(slug: string) {
    setQuery("");
    setDraft(null);
    if (!value.includes(slug)) {
      onChange([...value, slug]);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor="desk-channel-search">Distribution Channels</FieldLabel>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((slug) => (
            <Badge key={slug} variant="secondary">
              {bySlug.get(slug)?.breadcrumb ?? slug}
              <ChipRemoveButton
                aria-label={`Remove ${bySlug.get(slug)?.label ?? slug}`}
                onClick={() => onChange(value.filter((entry) => entry !== slug))}
              />
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <ComboboxPicker
          trigger="input"
          id="desk-channel-search"
          className="min-w-0 flex-1"
          placeholder="Search events and products…"
          options={results.map((option) => ({
            value: option.slug,
            label: option.breadcrumb,
            detail: <span className="font-mono">{option.slug}</span>,
          }))}
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
          emptyText="No matching events or products."
          actions={[
            {
              key: "leaf",
              label: (typed) => (
                <span className="text-primary flex items-center gap-1.5">
                  <PlusIcon className="size-3.5" />
                  Add “{typed.trim()}” under {suggestedParentLabel}
                </span>
              ),
              visible: (typed) => typed.trim().length > 0 && suggestedParentId !== null,
              onSelect: (typed) => {
                if (suggestedParentId !== null) {
                  setDraft({ kind: "leaf", label: typed.trim(), parentId: suggestedParentId });
                }
              },
            },
            {
              key: "root",
              label: () => (
                <span className="text-primary flex items-center gap-1.5">
                  <PlusIcon className="size-3.5" />
                  Add a new series or product
                </span>
              ),
              onSelect: (typed) => setDraft({ kind: "root", label: typed.trim() }),
            },
          ]}
        />
        <PrintingDeskChannelBrowser channels={channels} selected={value} onSelect={add} />
      </div>

      {draft !== null && (
        <div className="rounded-lg border">
          {draft.kind === "leaf" ? (
            <NewLeafForm
              channels={channels}
              parents={parents}
              initialParentId={draft.parentId}
              initialLabel={draft.label}
              onCancel={() => setDraft(null)}
              onCreated={add}
            />
          ) : (
            <NewRootForm
              initialLabel={draft.label}
              onCancel={() => setDraft(null)}
              onCreated={add}
            />
          )}
        </div>
      )}
    </Field>
  );
}

function NewLeafForm({
  channels,
  parents,
  initialParentId,
  initialLabel,
  onCancel,
  onCreated,
}: {
  channels: readonly Channel[];
  parents: readonly Channel[];
  initialParentId: string;
  initialLabel: string;
  onCancel: () => void;
  onCreated: (slug: string) => void;
}) {
  const createChannel = useCreateDistributionChannel();
  const [parentId, setParentId] = useState(initialParentId);
  const [label, setLabel] = useState(initialLabel);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");

  const parent = channels.find((channel) => channel.id === parentId);
  const siblingSlugs = channels
    .filter((channel) => channel.parentId === parentId)
    .map((channel) => channel.slug);
  const suggested = suggestChannelSlug({
    parentSlug: parent?.slug ?? "",
    siblingSlugs,
    label,
  });
  const effectiveSlug = slugTouched ? slug : suggested;
  const canSubmit = label.trim().length > 0 && effectiveSlug.length > 0 && !createChannel.isPending;

  async function submit() {
    if (!canSubmit || !parent) {
      return;
    }
    const created = await createChannel.mutateAsync({
      slug: effectiveSlug,
      label: label.trim(),
      kind: parent.kind,
      parentId,
    });
    onCreated(created.slug);
  }

  return (
    <div className="space-y-3 p-3">
      <Field>
        <FieldLabel htmlFor="desk-channel-parent">Part of</FieldLabel>
        <SimpleSelect
          id="desk-channel-parent"
          items={parents.map((channel) => ({ value: channel.id, label: channel.label }))}
          value={parentId}
          onChange={setParentId}
          className="w-full"
        />
        {parent?.childrenLabel && <FieldDescription>{parent.childrenLabel}</FieldDescription>}
      </Field>

      <Field>
        <FieldLabel htmlFor="desk-channel-label">Name</FieldLabel>
        <Input
          id="desk-channel-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="October 2026"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="desk-channel-slug">Short name</FieldLabel>
        <Input
          id="desk-channel-slug"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />
        <FieldDescription>
          Suggested from the ones already there. Change it if it looks off.
        </FieldDescription>
      </Field>

      <div className="flex gap-2">
        <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const KIND_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "product", label: "Product" },
] as const;

function NewRootForm({
  initialLabel,
  onCancel,
  onCreated,
}: {
  initialLabel: string;
  onCancel: () => void;
  onCreated: (slug: string) => void;
}) {
  const createChannel = useCreateDistributionChannel();
  const [label, setLabel] = useState(initialLabel);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<"event" | "product">("event");
  const [childrenLabel, setChildrenLabel] = useState("");

  const effectiveSlug = slugTouched ? slug : slugifyLabel(label);
  const canSubmit = label.trim().length > 0 && effectiveSlug.length > 0 && !createChannel.isPending;

  async function submit() {
    if (!canSubmit) {
      return;
    }
    const created = await createChannel.mutateAsync({
      slug: effectiveSlug,
      label: label.trim(),
      kind,
      parentId: null,
      childrenLabel: childrenLabel.trim().length > 0 ? childrenLabel.trim() : null,
    });
    onCreated(created.slug);
  }

  return (
    <div className="space-y-3 p-3">
      <Field>
        <FieldLabel htmlFor="desk-root-label">Name</FieldLabel>
        <Input
          id="desk-root-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Nexus Night"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="desk-root-slug">Short name</FieldLabel>
        <Input
          id="desk-root-slug"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="desk-root-kind">Event or product</FieldLabel>
        <SimpleSelect
          id="desk-root-kind"
          items={KIND_OPTIONS}
          value={kind}
          onChange={setKind}
          className="w-full"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="desk-root-children">What its entries are called</FieldLabel>
        <Input
          id="desk-root-children"
          value={childrenLabel}
          onChange={(event) => setChildrenLabel(event.target.value)}
          placeholder="Month"
        />
        <FieldDescription>
          Only needed if this one has entries under it, like a month or a stop.
        </FieldDescription>
      </Field>

      <div className="flex gap-2">
        <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
