import { isRegenerateImagesCheckpoint } from "@openrift/shared/contracts/admin/job-results";
import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { pluralize } from "@openrift/shared/strings";
import type { RehostImageResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { JobRunStatusLine } from "@/features/admin/components/job-run-status-line";
import { useLatestJobRun } from "@/features/admin/hooks/use-latest-job-run";
import {
  useBrokenImages,
  useCancelRegenerateImages,
  useCleanupOrphaned,
  useClearRehosted,
  useLowResImages,
  useMigrateDirectories,
  useMissingImages,
  useRegenerateImages,
  useRehostImages,
  useRehostStatus,
  useUnrehostImages,
} from "@/features/admin/hooks/use-rehost";
import {
  filterMissingImagesByLanguage,
  summarizeMissingImagesByLanguage,
} from "@/features/admin/lib/missing-images";
import { useLanguageList } from "@/hooks/use-enums";

const REGENERATE_KIND = "images.regenerate";
const ALL_LANGUAGES = "__all";

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;
const BYTES_PER_UNIT = 1024;
const MAX_DISPLAYED_ERRORS = 5;

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const i = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT));
  const value = bytes / BYTES_PER_UNIT ** i;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${BYTE_UNITS[i]}`;
}

function MutationStatus({
  mutation,
  label,
}: {
  mutation: {
    isSuccess: boolean;
    isError: boolean;
    data?: RehostImageResponse;
    error?: Error | null;
  };
  label: string;
}) {
  if (mutation.isSuccess && mutation.data) {
    const d = mutation.data;
    const count = d.rehosted;
    const total = d.total;
    const errors = d.errors;
    const verb = label === "rehost" ? "Rehosted" : "Regenerated";
    return (
      <div>
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <CheckIcon className="text-success size-4 shrink-0" />
          {verb} {count} / {total} images
        </p>
        {errors.length > 0 && (
          <ul className="text-muted-foreground mt-1 ml-5 list-disc">
            {errors.slice(0, MAX_DISPLAYED_ERRORS).map((err) => (
              <li key={err}>{err}</li>
            ))}
            {errors.length > MAX_DISPLAYED_ERRORS && (
              <li>...and {errors.length - MAX_DISPLAYED_ERRORS} more</li>
            )}
          </ul>
        )}
      </div>
    );
  }
  if (mutation.isError) {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <XIcon className="text-destructive size-4 shrink-0" />
        {mutation.error?.message}
      </p>
    );
  }
  return null;
}

/** Driven by the polled job_runs row, not client-side mutation state, so it survives a tab refresh. */
function RegenerateJobStatus({ run }: { run: JobRunView }) {
  const checkpoint = isRegenerateImagesCheckpoint(run.result) ? run.result : null;
  if (!checkpoint) {
    return run.status === "failed" ? (
      <JobRunStatusLine run={run} failedText="Regenerate failed" />
    ) : null;
  }

  const pct =
    checkpoint.totalFiles > 0
      ? Math.round((checkpoint.processed / checkpoint.totalFiles) * 100)
      : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span>
          {checkpoint.processed} / {checkpoint.totalFiles} processed
          {run.status === "running" && checkpoint.cancelRequested && " · cancelling…"}
          {run.status === "failed" &&
            (checkpoint.cancelRequested ? " · cancelled" : ` · failed: ${run.errorMessage ?? ""}`)}
          {run.status === "succeeded" &&
            ` · regenerated ${checkpoint.regenerated}, failed ${checkpoint.failed}`}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} />
      <ErrorsList errors={checkpoint.errors} />
    </div>
  );
}

function SimpleMutationResult<T>({
  mutation,
  renderSuccess,
}: {
  mutation: { isSuccess: boolean; isError: boolean; data?: T; error?: Error | null };
  renderSuccess: (data: T) => React.ReactNode;
}) {
  if (mutation.isSuccess && mutation.data) {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <CheckIcon className="text-success size-4 shrink-0" />
        {renderSuccess(mutation.data)}
      </p>
    );
  }
  if (mutation.isError) {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <XIcon className="text-destructive size-4 shrink-0" />
        {mutation.error?.message}
      </p>
    );
  }
  return null;
}

function ErrorsList({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }
  return (
    <ul className="text-muted-foreground mt-1 ml-5 list-disc">
      {errors.slice(0, MAX_DISPLAYED_ERRORS).map((err) => (
        <li key={err}>{err}</li>
      ))}
      {errors.length > MAX_DISPLAYED_ERRORS && (
        <li>...and {errors.length - MAX_DISPLAYED_ERRORS} more</li>
      )}
    </ul>
  );
}

function ManageSection() {
  const { data: status, refetch } = useRehostStatus();
  const { data: latestRegenRun } = useLatestJobRun(REGENERATE_KIND);

  const rehostMutation = useRehostImages(() => void refetch());
  const regenMutation = useRegenerateImages();
  const cancelRegenMutation = useCancelRegenerateImages();
  const clearMutation = useClearRehosted();
  const cleanupMutation = useCleanupOrphaned();
  const migrateMutation = useMigrateDirectories();

  if (!status) {
    return null;
  }

  const pct = status.total > 0 ? (status.rehosted / status.total) * 100 : 0;
  const allDone = status.external === 0;
  const totalFiles = status.disk.sets.reduce((sum, s) => sum + s.fileCount, 0);
  const regenRunning = latestRegenRun?.status === "running";
  // A failed run with unprocessed items is auto-resumable from the server side;
  // surface that as a "Resume" label so the user knows what'll happen.
  const resumableCheckpoint =
    latestRegenRun?.status === "failed" && isRegenerateImagesCheckpoint(latestRegenRun.result)
      ? latestRegenRun.result
      : null;
  const canResume =
    resumableCheckpoint !== null &&
    resumableCheckpoint.lastProcessedIndex < resumableCheckpoint.totalFiles - 1;
  const anyPending =
    rehostMutation.isPending ||
    regenMutation.isPending ||
    cancelRegenMutation.isPending ||
    clearMutation.isPending ||
    cleanupMutation.isPending ||
    migrateMutation.isPending ||
    regenRunning;

  return (
    <SettingsSection
      title="Manage Rehosted Images"
      description={
        <>
          {status.rehosted} / {status.total} images rehosted
          {status.disk.totalBytes > 0 &&
            ` · ${totalFiles} files · ${formatBytes(status.disk.totalBytes)}`}
          {status.disk.byResolution.length > 0 && (
            <>
              {" · "}
              {status.disk.byResolution
                .map((r) => `${r.resolution}: ${r.fileCount} / ${formatBytes(r.bytes)}`)
                .join(", ")}
            </>
          )}
          {status.orphanedFiles > 0 && ` · ${status.orphanedFiles} orphaned`}
        </>
      }
    >
      <Progress value={pct} className="h-1.5" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={anyPending || migrateMutation.isSuccess}
          pending={migrateMutation.isPending}
          onClick={() => migrateMutation.mutate()}
        >
          Migrate directories
        </Button>
        <Button
          variant="outline"
          disabled={anyPending || !status.disk.totalBytes}
          pending={regenMutation.isPending}
          onClick={() => regenMutation.mutate({ skipExisting: true, reset: true })}
        >
          Fill missing variants
        </Button>
        <Button
          variant="outline"
          disabled={anyPending || !status.disk.totalBytes}
          onClick={() => regenMutation.mutate({ scansOnly: true })}
        >
          Regenerate scans
        </Button>
        <Button
          variant="outline"
          disabled={anyPending || !status.disk.totalBytes}
          pending={regenRunning}
          onClick={() => regenMutation.mutate({})}
        >
          {resumableCheckpoint && canResume
            ? `Resume regeneration (${resumableCheckpoint.lastProcessedIndex + 1}/${resumableCheckpoint.totalFiles})`
            : "Regenerate resolutions"}
        </Button>
        {canResume && (
          <Button
            variant="outline"
            disabled={anyPending || !status.disk.totalBytes}
            onClick={() => regenMutation.mutate({ reset: true })}
          >
            Start fresh
          </Button>
        )}
        {regenRunning && (
          <Button
            variant="outline"
            pending={cancelRegenMutation.isPending}
            onClick={() => cancelRegenMutation.mutate()}
          >
            Cancel regeneration
          </Button>
        )}
        <Button
          disabled={anyPending || allDone}
          pending={rehostMutation.isPending}
          onClick={() => rehostMutation.mutate()}
        >
          Rehost missing
        </Button>
        <Button
          variant="outline"
          disabled={anyPending || !status.orphanedFiles}
          pending={cleanupMutation.isPending}
          onClick={() => cleanupMutation.mutate()}
        >
          Delete orphaned
        </Button>
        <ConfirmActionButton
          title="Delete all rehosted images?"
          description="This will delete all locally cached images. They can be re-fetched by running rehost again."
          confirmLabel="Clear"
          onConfirm={() => clearMutation.mutateAsync()}
          disabled={anyPending || !status.rehosted}
          trigger={<Button variant="destructive" />}
        >
          Clear
        </ConfirmActionButton>
      </div>

      {latestRegenRun && <RegenerateJobStatus run={latestRegenRun} />}

      {migrateMutation.isSuccess && migrateMutation.data && (
        <div>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <CheckIcon className="text-success size-4 shrink-0" />
            Scanned {migrateMutation.data.scanned} files: {migrateMutation.data.moved} moved,{" "}
            {migrateMutation.data.skipped} skipped
            {migrateMutation.data.failed > 0 && `, ${migrateMutation.data.failed} failed`}
          </p>
          <ErrorsList errors={migrateMutation.data.errors} />
        </div>
      )}
      {migrateMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {migrateMutation.error?.message}
        </p>
      )}

      <MutationStatus mutation={rehostMutation} label="rehost" />
      {regenMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {regenMutation.error?.message}
        </p>
      )}
      {cancelRegenMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {cancelRegenMutation.error?.message}
        </p>
      )}

      {cleanupMutation.isSuccess && cleanupMutation.data && (
        <div>
          <SimpleMutationResult
            mutation={cleanupMutation}
            renderSuccess={(d: { scanned: number; deleted: number }) =>
              `Scanned ${d.scanned} files, deleted ${d.deleted} orphaned`
            }
          />
          <ErrorsList errors={cleanupMutation.data.errors} />
        </div>
      )}
      {cleanupMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {cleanupMutation.error?.message}
        </p>
      )}
    </SettingsSection>
  );
}

function MissingImagesSection() {
  const { data: cards } = useMissingImages();
  const languageList = useLanguageList();
  const [language, setLanguage] = useState<string | null>(null);

  if (!cards || cards.length === 0) {
    return null;
  }

  const summaries = summarizeMissingImagesByLanguage(
    cards,
    languageList.map((entry) => entry.code),
  );
  const shown = filterMissingImagesByLanguage(cards, language);

  return (
    <SettingsSection
      title="Missing Images"
      description={
        <>
          {shown.length} {pluralize(shown.length, "card has", "cards have")} printings without an
          active front-face image
          {language === null ? "" : ` in ${language}`}.
        </>
      }
    >
      <ToggleGroup
        variant="outline"
        size="sm"
        className="flex-wrap"
        value={[language ?? ALL_LANGUAGES]}
        aria-label="Filter by language"
        onValueChange={([next]) =>
          setLanguage(next === undefined || next === ALL_LANGUAGES ? null : next)
        }
      >
        <ToggleGroupItem value={ALL_LANGUAGES}>All {cards.length}</ToggleGroupItem>
        {summaries.map((summary) => (
          <ToggleGroupItem key={summary.language} value={summary.language}>
            {summary.language} {summary.cards}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <RowList className="text-sm">
        {shown.map((card) => (
          <RowListItem key={card.cardId} className="flex-wrap gap-1.5">
            <TextLink
              variant="muted"
              render={<Link to="/admin/cards/$cardSlug" params={{ cardSlug: card.slug }} />}
            >
              <span className="text-muted-foreground/60">{card.slug}</span> {card.name}
            </TextLink>
            {card.byLanguage.map((entry) => (
              <Badge key={entry.language} variant="neutral">
                {entry.language} {entry.count}
              </Badge>
            ))}
          </RowListItem>
        ))}
      </RowList>
    </SettingsSection>
  );
}

function BySetList<T extends { imageId: string }>({
  groups,
  renderEntry,
}: {
  groups: readonly (readonly [string, readonly T[]])[];
  renderEntry: (entry: T) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map(([setSlug, entries]) => (
        <div key={setSlug} className="flex flex-col gap-2">
          <SectionHeading as="h4" size="sm">
            {setSlug}
          </SectionHeading>
          <RowList className="text-sm">
            {entries.map((entry) => (
              <RowListItem key={entry.imageId} className="items-baseline gap-2">
                {renderEntry(entry)}
              </RowListItem>
            ))}
          </RowList>
        </div>
      ))}
    </div>
  );
}

function BrokenImagesSection() {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading } = useBrokenImages(enabled);
  const unrehostMutation = useUnrehostImages();

  if (!enabled) {
    return (
      <SettingsSection
        title="Broken Images"
        description="Scan disk for rehosted images with missing files."
        action={
          <Button variant="outline" onClick={() => setEnabled(true)}>
            Check
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return <SettingsSection title="Broken Images" description="Scanning disk for missing files…" />;
  }

  if (!data || data.broken.length === 0) {
    return <SettingsSection title="Broken Images" description="No broken images found." />;
  }

  const bySet = new Map<string, typeof data.broken>();
  for (const entry of data.broken) {
    const list = bySet.get(entry.setSlug) ?? [];
    list.push(entry);
    bySet.set(entry.setSlug, list);
  }

  const imageIds = data.broken.map((entry) => entry.imageId);

  return (
    <SettingsSection
      title="Broken Images"
      description={
        <>
          {data.broken.length} of {data.total} rehosted{" "}
          {pluralize(data.broken.length, "image is", "images are")} missing files on disk.
        </>
      }
      action={
        <ConfirmActionButton
          title={`Un-rehost ${data.broken.length} broken ${pluralize(data.broken.length, "image")}?`}
          description="Clears the rehosted URL on each image so the next Rehost missing run re-downloads and regenerates them from the original source."
          confirmLabel="Un-rehost all"
          onConfirm={() => unrehostMutation.mutateAsync(imageIds)}
          trigger={<Button variant="destructive" />}
        >
          Un-rehost all
        </ConfirmActionButton>
      }
    >
      {unrehostMutation.isSuccess && unrehostMutation.data && (
        <div>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <CheckIcon className="text-success size-4 shrink-0" />
            Un-rehosted {unrehostMutation.data.unrehosted} / {unrehostMutation.data.total} images
          </p>
          <ErrorsList errors={unrehostMutation.data.errors} />
        </div>
      )}
      {unrehostMutation.isError && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <XIcon className="text-destructive size-4 shrink-0" />
          {unrehostMutation.error?.message}
        </p>
      )}
      <BySetList
        groups={[...bySet.entries()]}
        renderEntry={(entry) => (
          <>
            <TextLink
              variant="inherit"
              render={<Link to="/admin/cards/$cardSlug" params={{ cardSlug: entry.cardSlug }} />}
            >
              <span className="text-muted-foreground/60">{entry.printingShortCode}</span>{" "}
              {entry.cardName}
            </TextLink>
            <span className="text-muted-foreground truncate">{entry.rehostedUrl}</span>
          </>
        )}
      />
    </SettingsSection>
  );
}

function LowResImagesSection() {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading } = useLowResImages(enabled);

  if (!enabled) {
    return (
      <SettingsSection
        title="Low-Resolution Images"
        description="Scan rehosted images for any whose source short edge is under 400px."
        action={
          <Button variant="outline" onClick={() => setEnabled(true)}>
            Check
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <SettingsSection title="Low-Resolution Images" description="Scanning image dimensions…" />
    );
  }

  if (!data || data.lowRes.length === 0) {
    return (
      <SettingsSection
        title="Low-Resolution Images"
        description="No low-resolution images found."
      />
    );
  }

  const bySet = new Map<string, typeof data.lowRes>();
  for (const entry of data.lowRes) {
    const list = bySet.get(entry.setSlug) ?? [];
    list.push(entry);
    bySet.set(entry.setSlug, list);
  }

  return (
    <SettingsSection
      title="Low-Resolution Images"
      description={
        <>
          {data.lowRes.length} of {data.total} rehosted{" "}
          {pluralize(data.lowRes.length, "image has", "images have")} a full-resolution width under
          600px.
        </>
      }
    >
      <BySetList
        groups={[...bySet.entries()]}
        renderEntry={(entry) => (
          <>
            <TextLink
              variant="inherit"
              render={<Link to="/admin/cards/$cardSlug" params={{ cardSlug: entry.cardSlug }} />}
            >
              <span className="text-muted-foreground/60">{entry.printingShortCode}</span>{" "}
              {entry.cardName}
            </TextLink>
            <span className="text-muted-foreground">
              {entry.width}×{entry.height}
            </span>
          </>
        )}
      />
    </SettingsSection>
  );
}

export function ImagesPage() {
  return (
    <div className="flex flex-col gap-8">
      <AdminPageTopBar title="Images" />
      <BrokenImagesSection />
      <LowResImagesSection />
      <MissingImagesSection />
      <ManageSection />
    </div>
  );
}
