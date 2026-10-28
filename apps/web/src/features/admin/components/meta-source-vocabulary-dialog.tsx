import type {
  MetaSourceFormat,
  MetaSourceTemplate,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDay, formatRelativeTime } from "@openrift/shared/format-date";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { announceSyncTrigger } from "@/features/admin/components/meta-catalog-shared";
import type {
  MetaSourceFormatInput,
  MetaSourceTemplateInput,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import {
  useMetaArchiveJobs,
  useMetaSourceFormats,
  useMetaSourceTemplates,
  useMetaSyncSettings,
  useRunMetaSync,
  useUpdateMetaSourceFormat,
  useUpdateMetaSourceTemplate,
  useUpdateMetaSyncSettings,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import { runningRunId } from "@/features/meta/lib/meta-catalog-display";
import { metaEventTierLabels } from "@/features/meta/lib/meta-format";
import { useDeckFormatList } from "@/hooks/use-enums";

const UNMAPPED = "__unmapped";

function tierItems(): Record<string, string> {
  return {
    [UNMAPPED]: "Unmapped",
    ...metaEventTierLabels(),
  };
}

function TemplateRow({
  template,
  busy,
  onUpdate,
}: {
  template: MetaSourceTemplate;
  busy: boolean;
  onUpdate: (input: MetaSourceTemplateInput) => void;
}) {
  const name = template.sourceName ?? template.templateId;

  function toggleWatched(watched: boolean) {
    onUpdate({ templateId: template.templateId, watched });
  }

  // BaseUI hands null when the open Select is dismissed without a pick; the
  // "Unmapped" item is the explicit clear, so null is not one.
  function setTier(value: string | null) {
    if (value === null) {
      return;
    }
    onUpdate({
      templateId: template.templateId,
      tier: value === UNMAPPED ? null : (value as MetaEventTier),
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {template.sourceName ?? (
          <span className="text-muted-foreground font-mono text-xs">{template.templateId}</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground block max-w-64 truncate">
          {template.sampleEventName ?? "—"}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {template.eventCount.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {template.avgPlayers === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span title={`Over ${template.ranEventCount.toLocaleString()} events that have run`}>
            {template.avgPlayers.toFixed(1)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <span
          className="text-muted-foreground"
          title={template.lastStartAt === null ? undefined : formatDay(template.lastStartAt)}
        >
          {template.lastStartAt === null ? "—" : formatRelativeTime(template.lastStartAt)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select value={template.tier ?? UNMAPPED} onValueChange={setTier} items={tierItems()}>
            <SelectTrigger className="w-36" aria-label={`Tier for ${name}`} disabled={busy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(tierItems()).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </TableCell>
      <TableCell>
        <Switch
          id={`meta-template-watched-${template.templateId}`}
          checked={template.watched}
          disabled={busy}
          onCheckedChange={toggleWatched}
        />
        <Label htmlFor={`meta-template-watched-${template.templateId}`} className="sr-only">
          Watch {name}
        </Label>
      </TableCell>
    </TableRow>
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

  const valid = /^\d+$/u.test(draft) && Number(draft) > 0;
  const changed = data !== undefined && valid && Number(draft) !== data.competitivePlayerFloor;

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
          onClick={() => update.mutate({ competitivePlayerFloor: Number(draft) })}
        >
          Save floor
        </Button>
      </div>
      {!valid && data !== undefined && (
        <FieldError>Enter a whole number of players above zero.</FieldError>
      )}
    </div>
  );
}

function RetierHint() {
  const run = useRunMetaSync();
  const { data } = useMetaArchiveJobs();
  const running = runningRunId(data?.runs ?? [], "meta.retier") !== null;

  async function start() {
    let result;
    try {
      result = await run.mutateAsync({ trigger: "runRetier" });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    announceSyncTrigger("Reapply tier rules", result);
  }

  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
      <p className="text-muted-foreground min-w-60 flex-1 text-sm">
        Tier changes reach published events when you reapply tier rules.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={run.isPending || running}
        onClick={() => void start()}
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
      <div className="overflow-x-auto">
        <Table className={ADMIN_TABLE_CLASS}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-60">Event type</TableHead>
              <TableHead>Sample event</TableHead>
              <TableHead className="w-20 text-right">Events</TableHead>
              <TableHead className="w-24 text-right">Avg players</TableHead>
              <TableHead className="w-28">Latest</TableHead>
              <TableHead className="w-56">Counts as</TableHead>
              <TableHead className="w-24">Watched</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-20 text-center">
                  {data === undefined
                    ? "Loading the event types…"
                    : "No event types yet. Refresh mirror reads them from the source."}
                </TableCell>
              </TableRow>
            )}
            {templates.map((template) => (
              <TemplateRow
                key={template.templateId}
                template={template}
                busy={update.isPending}
                onUpdate={(input) => update.mutate(input)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function FormatRow({
  format,
  options,
  busy,
  onUpdate,
}: {
  format: MetaSourceFormat;
  options: { value: string; label: string }[];
  busy: boolean;
  onUpdate: (input: MetaSourceFormatInput) => void;
}) {
  // A dismissed Select reports null; unmapping is the "Unmapped" item, not null.
  function pick(next: string | null) {
    if (next === null) {
      return;
    }
    onUpdate({
      sourceFormat: format.sourceFormat,
      mappedFormat: next === UNMAPPED ? null : next,
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{format.sourceFormat}</TableCell>
      <TableCell className="text-right tabular-nums">
        {format.eventCount.toLocaleString()}
      </TableCell>
      <TableCell>
        <Select
          items={options}
          value={format.mappedFormat ?? UNMAPPED}
          onValueChange={pick}
          disabled={busy}
        >
          <SelectTrigger className="w-48" aria-label={`Format for ${format.sourceFormat}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
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
      <div className="overflow-x-auto">
        <Table className={ADMIN_TABLE_CLASS}>
          <TableHeader>
            <TableRow>
              <TableHead>At the source</TableHead>
              <TableHead className="w-20 text-right">Events</TableHead>
              <TableHead className="w-52">Ours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formats.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground h-20 text-center">
                  {data === undefined
                    ? "Loading the formats…"
                    : "No mirrored event has a format yet."}
                </TableCell>
              </TableRow>
            )}
            {formats.map((format) => (
              <FormatRow
                key={format.sourceFormat}
                format={format}
                options={options}
                busy={update.isPending}
                onUpdate={(input) => update.mutate(input)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
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
