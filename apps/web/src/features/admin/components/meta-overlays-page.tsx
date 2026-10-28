import { UploadIcon } from "lucide-react";
import { useState } from "react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
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
              Ignored players
            </PageTopBarButton>
            <PageTopBarButton
              onClick={() => {
                setUploadOpen(true);
              }}
            >
              <UploadIcon />
              Upload a file
            </PageTopBarButton>
          </>
        }
      />
      {total === 0 ? (
        <div className="py-10 text-center">
          <p className="font-medium">Nothing waiting</p>
          <p className="text-muted-foreground text-sm">
            Uploads and contributor corrections land here.
          </p>
        </div>
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
              Showing the 200 oldest contributor corrections.
            </p>
          )}
          {[
            { label: "From contributors", groups: shown.filter((group) => group.fromContributor) },
            {
              label: "From sources and uploads, oldest first",
              groups: shown.filter((group) => !group.fromContributor),
            },
          ]
            .filter((section) => section.groups.length > 0)
            .map((section) => (
              <section key={section.label} aria-label={section.label} className="space-y-3">
                <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {section.label}
                </h2>
                {section.groups.map((group) => (
                  <MetaReviewEventGroup key={group.key} group={group} />
                ))}
              </section>
            ))}
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
