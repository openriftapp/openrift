import type {
  MetaSourceFormat,
  MetaSourceTemplate,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import type { MetaEventTier } from "@openrift/shared/types/enums";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountCell, InstantCell } from "@/features/admin/components/admin-crud-shared";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import type {
  MetaSourceFormatInput,
  MetaSourceTemplateInput,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import {
  useMetaArchiveJobs,
  useMetaSourceFormats,
  useMetaSourceTemplates,
  useMetaSyncSettings,
  useStartMetaJob,
  useUpdateMetaSourceFormat,
  useUpdateMetaSourceTemplate,
  useUpdateMetaSyncSettings,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { parseIntegerInput } from "@/features/admin/lib/integer-input";
import { runningRunId } from "@/features/admin/lib/meta-catalog-display";
import { metaEventTierLabels } from "@/features/meta/lib/meta-format";
import { useDeckFormatList } from "@/hooks/use-enums";
import { formatCount } from "@/lib/format";

const UNMAPPED = "__unmapped";

function tierItems() {
  return [
    { value: UNMAPPED, label: "Unmapped" },
    ...Object.entries(metaEventTierLabels()).map(([value, label]) => ({ value, label })),
  ];
}

interface TemplateCellProps extends AdminCellSlotProps<MetaSourceTemplate> {
  busy?: boolean;
  onUpdate?: (input: MetaSourceTemplateInput) => void;
}

function TemplateNameCell({ row: template }: AdminCellSlotProps<MetaSourceTemplate>) {
  if (!template) {
    return null;
  }
  return (
    <span className="font-medium">
      {template.sourceName ?? (
        <span className="text-muted-foreground font-mono text-xs">{template.templateId}</span>
      )}
    </span>
  );
}

function SampleEventCell({ row: template }: AdminCellSlotProps<MetaSourceTemplate>) {
  if (!template) {
    return null;
  }
  return (
    <span className="text-muted-foreground block max-w-64 truncate">
      {template.sampleEventName ?? EMPTY_VALUE_TEXT}
    </span>
  );
}

function AvgPlayersCell({ row: template }: AdminCellSlotProps<MetaSourceTemplate>) {
  if (!template) {
    return null;
  }
  if (template.avgPlayers === null) {
    return <span className="text-muted-foreground">{EMPTY_VALUE_TEXT}</span>;
  }
  return (
    <span
      className="tabular-nums"
      title={`Over ${formatCount(template.ranEventCount)} events that have run`}
    >
      {template.avgPlayers.toFixed(1)}
    </span>
  );
}

function TierCell({ row: template, busy = false, onUpdate }: TemplateCellProps) {
  if (!template || !onUpdate) {
    return null;
  }
  const name = template.sourceName ?? template.templateId;
  // BaseUI hands null when the open Select is dismissed without a pick; the
  // "Unmapped" item is the explicit clear, so null is not one.
  function setTier(value: string | null) {
    if (value === null || !template || !onUpdate) {
      return;
    }
    onUpdate({
      templateId: template.templateId,
      tier: value === UNMAPPED ? null : (value as MetaEventTier),
    });
  }
  return (
    <div className="flex items-center gap-2">
      <SimpleSelect
        items={tierItems()}
        value={template.tier ?? UNMAPPED}
        onChange={setTier}
        label={`Tier for ${name}`}
        size="sm"
        disabled={busy}
        className="w-36"
      />
      {template.tier === null && template.suggestedTier !== null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setTier(template.suggestedTier)}
        >
          Suggest: {metaEventTierLabels()[template.suggestedTier]}
        </Button>
      )}
    </div>
  );
}

function WatchedCell({ row: template, busy = false, onUpdate }: TemplateCellProps) {
  if (!template || !onUpdate) {
    return null;
  }
  const name = template.sourceName ?? template.templateId;
  return (
    <>
      <Switch
        id={`meta-template-watched-${template.templateId}`}
        checked={template.watched}
        disabled={busy}
        onCheckedChange={(watched) => onUpdate({ templateId: template.templateId, watched })}
      />
      <Label htmlFor={`meta-template-watched-${template.templateId}`} className="sr-only">
        Watch {name}
      </Label>
    </>
  );
}

function PlayerFloorField() {
  const { data } = useMetaSyncSettings();
  const update = useUpdateMetaSyncSettings();
  const [draft, setDraft] = useState("");
  const [seenAt, setSeenAt] = useState<string | null>(null);
  if (data !== undefined && data.updatedAt !== seenAt) {
    setSeenAt(data.updatedAt);
    setDraft(String(data.competitivePlayerFloor));
  }

  const floor = parseIntegerInput(draft, 1);
  const changed =
    data !== undefined && typeof floor === "number" && floor !== data.competitivePlayerFloor;

  return (
    <div className="bg-muted/40 space-y-2 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="meta-competitive-floor" className="text-sm">
          Events with at least
        </Label>
        <Input
          id="meta-competitive-floor"
          type="number"
          min={1}
          value={draft}
          disabled={data === undefined || update.isPending}
          onChange={(event) => setDraft(event.target.value)}
          className="w-24"
        />
        <p className="text-muted-foreground min-w-60 flex-1 text-sm">
          players count as Competitive or higher, on every source.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!changed || update.isPending}
          onClick={() => {
            if (typeof floor === "number") {
              update.mutate({ competitivePlayerFloor: floor });
            }
          }}
        >
          Save floor
        </Button>
      </div>
      {typeof floor !== "number" && data !== undefined && (
        <FieldError>Enter a whole number of players above zero.</FieldError>
      )}
    </div>
  );
}

function RetierHint() {
  const run = useStartMetaJob();
  const { data } = useMetaArchiveJobs();
  const running = runningRunId(data?.runs ?? [], JOB_KIND.metaRetier) !== null;

  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
      <p className="text-muted-foreground min-w-60 flex-1 text-sm">
        Tier changes reach published events when you reapply tier rules.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={run.isPending || running}
        onClick={() => void run.start("runRetier", "Reapply tier rules")}
      >
        {running ? "Reapplying…" : "Reapply tier rules"}
      </Button>
    </div>
  );
}

function TemplatesSection() {
  const { data } = useMetaSourceTemplates();
  const update = useUpdateMetaSourceTemplate();
  const templates = data?.templates ?? [];

  return (
    <section className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Watched event types publish at any size and are checked more often on event day. Avg players
        counts events that have run. An event type with only an id is one the source no longer
        names.
      </p>
      <RetierHint />
      <AdminTable
        columns={[
          { header: "Event type", width: "w-60", cell: <TemplateNameCell /> },
          { header: "Sample event", cell: <SampleEventCell /> },
          {
            header: "Events",
            width: "w-20",
            align: "right",
            cell: <CountCell<MetaSourceTemplate> count={(template) => template.eventCount} />,
          },
          { header: "Avg players", width: "w-24", align: "right", cell: <AvgPlayersCell /> },
          {
            header: "Latest",
            width: "w-28",
            cell: (
              <InstantCell<MetaSourceTemplate> at={(template) => template.lastStartAt} relative />
            ),
          },
          {
            header: "Counts as",
            width: "w-56",
            cell: <TierCell busy={update.isPending} onUpdate={(input) => update.mutate(input)} />,
          },
          {
            header: "Watched",
            width: "w-24",
            cell: (
              <WatchedCell busy={update.isPending} onUpdate={(input) => update.mutate(input)} />
            ),
          },
        ]}
        data={templates}
        getRowKey={(template) => template.templateId}
        emptyText={
          data === undefined
            ? "Loading the event types…"
            : "No event types yet. Refresh mirror reads them from the source."
        }
      />
    </section>
  );
}

function SourceFormatCell({ row: format }: AdminCellSlotProps<MetaSourceFormat>) {
  if (!format) {
    return null;
  }
  return <span className="font-medium">{format.sourceFormat}</span>;
}

function FormatPickCell({
  row: format,
  options,
  busy = false,
  onUpdate,
}: AdminCellSlotProps<MetaSourceFormat> & {
  options?: { value: string; label: string }[];
  busy?: boolean;
  onUpdate?: (input: MetaSourceFormatInput) => void;
}) {
  if (!format || !options || !onUpdate) {
    return null;
  }
  // A dismissed Select reports null; unmapping is the "Unmapped" item, not null.
  function pick(next: string | null) {
    if (next === null || !format || !onUpdate) {
      return;
    }
    onUpdate({
      sourceFormat: format.sourceFormat,
      mappedFormat: next === UNMAPPED ? null : next,
    });
  }
  return (
    <SimpleSelect
      items={options}
      value={format.mappedFormat ?? UNMAPPED}
      onChange={pick}
      label={`Format for ${format.sourceFormat}`}
      size="sm"
      disabled={busy}
      className="w-48"
    />
  );
}

function FormatsSection() {
  const { data } = useMetaSourceFormats();
  const { formats: deckFormats } = useDeckFormatList();
  const update = useUpdateMetaSourceFormat();
  const formats = data?.formats ?? [];

  const options = [
    { value: UNMAPPED, label: "Unmapped" },
    ...deckFormats.map((entry) => ({ value: entry.slug, label: entry.label })),
  ];

  return (
    <section className="space-y-2">
      <p className="text-muted-foreground text-sm">
        An event with an unmapped format never auto-publishes and needs a format pick to publish.
      </p>
      <AdminTable
        columns={[
          { header: "At the source", cell: <SourceFormatCell /> },
          {
            header: "Events",
            width: "w-20",
            align: "right",
            cell: <CountCell<MetaSourceFormat> count={(format) => format.eventCount} />,
          },
          {
            header: "Ours",
            width: "w-52",
            cell: (
              <FormatPickCell
                options={options}
                busy={update.isPending}
                onUpdate={(input) => update.mutate(input)}
              />
            ),
          },
        ]}
        data={formats}
        getRowKey={(format) => format.sourceFormat}
        emptyText={
          data === undefined ? "Loading the formats…" : "No mirrored event has a format yet."
        }
      />
    </section>
  );
}

export function MetaSourceVocabularyDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Event types and formats, UVS Games</DialogTitle>
          <DialogDescription>
            Names come from the source. You set what they count as. Changes save as you make them.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="types" className="min-h-0">
          <TabsList variant="line">
            <TabsTrigger value="types">Event types</TabsTrigger>
            <TabsTrigger value="formats">Formats</TabsTrigger>
            <TabsTrigger value="floor">Tier floor</TabsTrigger>
          </TabsList>
          <div className="max-h-[65vh] overflow-y-auto pt-3">
            <TabsContent value="types">
              <TemplatesSection />
            </TabsContent>
            <TabsContent value="formats">
              <FormatsSection />
            </TabsContent>
            <TabsContent value="floor">
              <PlayerFloorField />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
