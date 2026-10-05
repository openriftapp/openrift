import { UploadIcon } from "lucide-react";
import { useState } from "react";

import { PageDescription, PageTopBarButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { MetaIgnoredSourcesDialog } from "@/features/admin/components/meta-ignored-sources-dialog";
import { MetaOverlayUploadDialog } from "@/features/admin/components/meta-overlay-upload-dialog";
import { MetaReviewEventGroup } from "@/features/admin/components/meta-review-event-group";
import { useAdminMetaOverlays } from "@/features/admin/hooks/use-admin-meta-overlays";
import { useMetaEventCorrections } from "@/features/admin/hooks/use-admin-meta-submissions";
import type { MetaReviewTriage } from "@/features/meta/lib/meta-review-queue";
import {
  META_REVIEW_TRIAGE,
  META_REVIEW_TRIAGE_LABELS,
  filterGroup,
  groupReviewQueue,
  sumTriageCounts,
  totalTriageCount,
} from "@/features/meta/lib/meta-review-queue";

const ALL = "all";

export function MetaOverlaysPage() {
  const { data } = useAdminMetaOverlays();
  const corrections = useMetaEventCorrections();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [picked, setPicked] = useState<MetaReviewTriage | null>(null);

  const groups = groupReviewQueue(data.overlays, corrections.data?.items ?? []);
  const counts = sumTriageCounts(groups);
  const total = totalTriageCount(counts);
  // A filter whose last row was just settled falls back to the whole queue.
  const triage = picked !== null && counts[picked] > 0 ? picked : null;
  const shown =
    triage === null
      ? groups
      : groups.map((group) => filterGroup(group, triage)).filter((group) => group !== null);

  return (
    <div className="space-y-4">
      <AdminPageTopBar
        title="Review"
        actions={
          <>
            <PageTopBarButton
              onClick={() => {
                setIgnoredOpen(true);
              }}
            >
              Dismissed keys
            </PageTopBarButton>
            <PageTopBarButton
              onClick={() => {
                setUploadOpen(true);
              }}
            >
              <UploadIcon />
              Upload
            </PageTopBarButton>
          </>
        }
      />
      <PageDescription>
        Corrections and decklists that sources and contributors have proposed, grouped by the event
        they land on. Accepting one re-promotes its event, so the patch lands and everything else
        stays as the sources published it.
      </PageDescription>

      {total === 0 ? (
        <p className="text-muted-foreground">Nothing waiting.</p>
      ) : (
        <>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={2}
            className="flex-wrap"
            value={[triage ?? ALL]}
            aria-label="Review filter"
            onValueChange={([next]) => {
              setPicked(META_REVIEW_TRIAGE.find((key) => key === next) ?? null);
            }}
          >
            <ToggleGroupItem value={ALL}>
              All
              <Badge variant={triage === null ? "count" : "neutral"}>{total}</Badge>
            </ToggleGroupItem>
            {META_REVIEW_TRIAGE.filter((key) => counts[key] > 0).map((key) => (
              <ToggleGroupItem key={key} value={key}>
                {META_REVIEW_TRIAGE_LABELS[key]}
                <Badge variant={triage === key ? "count" : "neutral"}>{counts[key]}</Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {corrections.data?.hasMore === true && (
            <p className="text-muted-foreground text-sm">
              Only the oldest corrections are shown. Close some out and the rest appear.
            </p>
          )}
          <div className="space-y-3">
            {shown.map((group) => (
              <MetaReviewEventGroup key={group.key} group={group} />
            ))}
          </div>
        </>
      )}

      {uploadOpen && (
        <MetaOverlayUploadDialog
          onClose={() => {
            setUploadOpen(false);
          }}
        />
      )}
      {ignoredOpen && (
        <MetaIgnoredSourcesDialog
          onClose={() => {
            setIgnoredOpen(false);
          }}
        />
      )}
    </div>
  );
}
