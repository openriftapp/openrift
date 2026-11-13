import { pluralize } from "@openrift/shared/strings";
import type { MetaEventDrift } from "@openrift/shared/types/api/meta";
import type { MetaEventOverlayField } from "@openrift/shared/types/enums";
import { META_EVENT_OVERLAY_FIELDS, META_EVENT_TIERS } from "@openrift/shared/types/enums";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockOpenIcon,
  LockIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";
import {
  useMetaEventDrift,
  useReleaseMetaEventOverlayField,
  useSetMetaSourcePriority,
  useWriteMetaEventOverlayFields,
} from "@/features/admin/hooks/use-admin-meta-overlays";
import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { reviewFieldLabel } from "@/features/admin/lib/meta-review-queue";
import { sourceProviderDisplay } from "@/features/admin/lib/meta-source-review";
import { metaEventTierLabels } from "@/features/meta/lib/meta-format";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn } from "@/lib/utils";

type DriftField = MetaEventDrift["fields"][number];

const MIN_PRIORITY = 0;
const MAX_PRIORITY = 999;

export function isOverlayField(field: string): field is MetaEventOverlayField {
  return (META_EVENT_OVERLAY_FIELDS as readonly string[]).includes(field);
}

export function isContested(field: DriftField): boolean {
  return (
    !field.claimedByOverlay &&
    field.bySource.some((cell) => cell.value !== null && cell.value !== field.live)
  );
}

function SourceHeader({ source }: { source: MetaEventDrift["sources"][number] }) {
  const provider = sourceProviderDisplay(source.provider ?? "manual");
  const setPriority = useSetMetaSourcePriority();

  async function move(delta: number): Promise<void> {
    const priority = Math.min(MAX_PRIORITY, Math.max(MIN_PRIORITY, source.priority + delta));
    if (!(await runReportedMutation(() => setPriority.mutateAsync({ id: source.id, priority })))) {
      return;
    }
    toast.success("Reordered. The published event is rebuilt from its sources.");
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={provider.variant}>{provider.label}</Badge>
      {!source.hasMirror && <span className="text-muted-foreground">not mirrored</span>}
      <span className="text-muted-foreground tabular-nums">#{source.priority}</span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Raise ${provider.label}'s priority`}
        disabled={setPriority.isPending || source.priority >= MAX_PRIORITY}
        onClick={() => {
          void move(1);
        }}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Lower ${provider.label}'s priority`}
        disabled={setPriority.isPending || source.priority <= MIN_PRIORITY}
        onClick={() => {
          void move(-1);
        }}
      >
        <ChevronDownIcon />
      </Button>
    </div>
  );
}

function ClaimForm({
  metaEventId,
  field,
  live,
  onDone,
}: {
  metaEventId: string;
  field: MetaEventOverlayField;
  live: string | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(live ?? "");
  const write = useWriteMetaEventOverlayFields();

  async function save(): Promise<void> {
    if (
      !(await runReportedMutation(() =>
        write.mutateAsync({ id: metaEventId, edits: [{ field, value: draft }] }),
      ))
    ) {
      return;
    }
    toast.success("Claimed. The archive owns this field now.");
    onDone();
  }

  return (
    <span className="flex items-center gap-1">
      {field === "tier" && (
        <SimpleSelect
          items={META_EVENT_TIERS.map((tier) => ({
            value: tier,
            label: metaEventTierLabels()[tier],
          }))}
          value={draft}
          onChange={setDraft}
          label="Tier"
          size="sm"
          className="w-36"
        />
      )}
      {field === "eventDate" && (
        <DatePicker
          value={draft}
          onValueChange={setDraft}
          onClear={() => {
            setDraft("");
          }}
        />
      )}
      {field !== "tier" && field !== "eventDate" && (
        <Input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          inputMode={field === "playerCount" ? "numeric" : undefined}
          className="h-7 w-44"
          aria-label={`New value for ${field}`}
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        aria-label="Save"
        disabled={write.isPending}
        onClick={() => {
          void save();
        }}
      >
        <CheckIcon />
      </Button>
      <Button size="sm" variant="ghost" aria-label="Cancel" onClick={onDone}>
        <XIcon />
      </Button>
    </span>
  );
}

function ReleaseButton({
  metaEventId,
  field,
}: {
  metaEventId: string;
  field: MetaEventOverlayField;
}) {
  const release = useReleaseMetaEventOverlayField();

  async function handleRelease(): Promise<void> {
    if (!(await runReportedMutation(() => release.mutateAsync({ id: metaEventId, field })))) {
      return;
    }
    toast.success("Released. The sources decide this field again.");
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Hand ${field} back to the sources`}
      disabled={release.isPending}
      onClick={() => {
        void handleRelease();
      }}
    >
      <LockOpenIcon />
    </Button>
  );
}

function DriftDotCell({ row: field }: AdminCellSlotProps<DriftField>) {
  if (!field || !isContested(field)) {
    return null;
  }
  return <span className="bg-warning block size-1.5 rounded-full" aria-hidden />;
}

function FieldNameCell({ row: field }: AdminCellSlotProps<DriftField>) {
  if (!field) {
    return null;
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5">
      {field.claimedByOverlay && <LockIcon className="size-3" aria-label="Set by hand" />}
      {reviewFieldLabel(field.field)}
    </span>
  );
}

function SourceValueCell({
  row: field,
  sourceIndex,
}: AdminCellSlotProps<DriftField> & { sourceIndex?: number }) {
  const cell = sourceIndex === undefined ? undefined : field?.bySource[sourceIndex];
  if (!field || !cell) {
    return null;
  }
  const contested = isContested(field);
  return (
    <span
      className={cn(
        "block",
        field.claimedByOverlay && "text-muted-foreground/50 line-through",
        contested && cell.value !== field.live && cell.value !== null && "text-warning",
      )}
    >
      <span className="block">{cell.value ?? EMPTY_VALUE_TEXT}</span>
      {cell.raw !== null && cell.raw !== cell.value && (
        <span className="text-muted-foreground text-2xs block">{cell.raw}</span>
      )}
    </span>
  );
}

function PublishedCell({
  row: field,
  metaEventId,
}: AdminCellSlotProps<DriftField> & { metaEventId?: string }) {
  const [claiming, setClaiming] = useState(false);
  if (!field || metaEventId === undefined) {
    return null;
  }
  const editable = isOverlayField(field.field) ? field.field : null;
  return (
    <span className="flex items-center gap-2">
      {claiming && editable !== null ? (
        <ClaimForm
          metaEventId={metaEventId}
          field={editable}
          live={field.live}
          onDone={() => {
            setClaiming(false);
          }}
        />
      ) : (
        <>
          <span className="font-medium">{field.live ?? EMPTY_VALUE_TEXT}</span>
          {field.claimedByOverlay ? (
            <Badge variant="outline">Set by hand</Badge>
          ) : (
            field.wonBy !== null && <Badge variant="outline">{field.wonBy}</Badge>
          )}
          {editable !== null && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Claim ${field.field} for the archive`}
              onClick={() => {
                setClaiming(true);
              }}
            >
              <PencilIcon />
            </Button>
          )}
          {editable !== null && field.claimedByOverlay && (
            <ReleaseButton metaEventId={metaEventId} field={editable} />
          )}
        </>
      )}
    </span>
  );
}

export function MetaEventDriftPanel({
  metaEventId,
  enabled,
}: {
  metaEventId: string;
  enabled: boolean;
}) {
  const { data, isPending, isError } = useMetaEventDrift(metaEventId, enabled);
  const [showAgreed, setShowAgreed] = useState(false);

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>The drift view could not be loaded.</AlertDescription>
      </Alert>
    );
  }
  if (isPending || data === undefined) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (data.sources.length === 0) {
    return (
      <p className="text-muted-foreground">
        No source is linked to this event, so every value here was entered by hand.
      </p>
    );
  }

  const contested = data.fields.filter((field) => isContested(field));
  const agreed = data.fields.filter((field) => !isContested(field));
  const shown = showAgreed ? data.fields : contested;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {data.sources.map((source) => (
          <SourceHeader key={source.id} source={source} />
        ))}
      </div>
      <p className="text-muted-foreground">
        When two sources give a field, the one higher in this order wins. A field set by hand stays
        as set until you release it.
      </p>

      {contested.length === 0 && !showAgreed ? (
        <p className="text-muted-foreground">Every field matches its sources.</p>
      ) : (
        <div className="overflow-x-auto">
          <AdminTable
            bare
            columns={[
              {
                header: "",
                id: "drift",
                headerTitle: "Drift",
                width: "w-1",
                cell: <DriftDotCell />,
              },
              { header: "Field", cell: <FieldNameCell /> },
              ...data.sources.map((source, index) => ({
                header: sourceProviderDisplay(source.provider ?? source.label).label,
                id: `source-${source.id}`,
                cell: <SourceValueCell sourceIndex={index} />,
              })),
              { header: "Published", cell: <PublishedCell metaEventId={metaEventId} /> },
            ]}
            data={shown}
            getRowKey={(field) => field.field}
          />
        </div>
      )}

      {agreed.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowAgreed(!showAgreed);
          }}
        >
          {showAgreed ? "Hide" : "Show"} {agreed.length} {pluralize(agreed.length, "field")} that
          agree
        </Button>
      )}
    </div>
  );
}
