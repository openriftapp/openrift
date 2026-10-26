import type {
  WorkspaceOwner,
  WorkspaceSegment,
  WorkspaceUploadSource,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { formatDay, formatDayTime, formatRelativeDay } from "@openrift/shared/format-date";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UploadIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SameDifferenceLine } from "@/features/catalog-workspace/components/same-difference-line";
import { useWorkspaceRole } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import {
  providerQueueLink,
  repeatedDifferenceInput,
  splitUploadSources,
  uploadChangeSummary,
  uploadOpenSummary,
  useWorkspaceUploads,
} from "@/features/catalog-workspace/hooks/use-workspace-uploads";
import { compactAge, OWNER_LABELS } from "@/features/catalog-workspace/lib/owner-items";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";

const LINK_CLASS = "text-primary text-sm underline-offset-4 hover:underline";

function uploadedDay(at: string): string {
  return formatRelativeDay(formatDay(at));
}

function ProviderQueueLink({
  owner,
  segment,
  provider,
  children,
}: {
  owner: WorkspaceOwner;
  segment: WorkspaceSegment;
  provider: string;
  children: ReactNode;
}) {
  const search = { provider, segment: segment === "open" ? undefined : segment };
  if (owner === "card") {
    return (
      <Link to="/admin/workspace/cards" search={search} className={LINK_CLASS}>
        {children}
      </Link>
    );
  }
  if (owner === "face") {
    return (
      <Link to="/admin/workspace/faces" search={search} className={LINK_CLASS}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/admin/workspace/printings" search={search} className={LINK_CLASS}>
      {children}
    </Link>
  );
}

function UploadRow({
  source,
  link,
  canDiscard,
}: {
  source: WorkspaceUploadSource;
  link: { owner: WorkspaceOwner; segment: WorkspaceSegment };
  canDiscard: boolean;
}) {
  const bulkInput = canDiscard ? repeatedDifferenceInput(source) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2 first:border-t-0">
      <Badge variant="info">{source.label}</Badge>
      <span className="text-muted-foreground text-sm">{uploadedDay(source.uploadedAt)}</span>
      <span className="min-w-0 flex-1 text-sm">{uploadChangeSummary(source)}</span>
      <ProviderQueueLink owner={link.owner} segment={link.segment} provider={source.provider}>
        {uploadOpenSummary(source)} in {OWNER_LABELS[link.owner]} ›
      </ProviderQueueLink>
      {source.oldestOpenAt !== null && (
        <span className="text-muted-foreground text-xs">
          oldest {compactAge(source.oldestOpenAt)}
        </span>
      )}
      {bulkInput !== null && (
        <SameDifferenceLine input={bulkInput} sourceLabel={source.label} value={bulkInput.value} />
      )}
    </li>
  );
}

export function LastUploadsSection() {
  const role = useWorkspaceRole();
  const enabled = role === "admin" || role === "reviewer";
  const { data, error } = useWorkspaceUploads(enabled);
  const { data: queue } = useQuery({ ...workspaceQueueQueryOptions(), enabled });

  if (!enabled) {
    return null;
  }

  const { active, quiet } = splitUploadSources(data?.sources ?? []);
  const items = queue?.items ?? [];
  const contributors = data?.contributors;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-1.5">
          <UploadIcon className="size-4" />
          Last uploads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error !== null && (
          <p className="text-muted-foreground text-sm">The uploads could not be loaded.</p>
        )}
        {data !== undefined && active.length === 0 && quiet.length === 0 && (
          <p className="text-muted-foreground text-sm">No uploads yet.</p>
        )}
        {active.length > 0 && (
          <ul>
            {active.map((source) => (
              <UploadRow
                key={source.provider}
                source={source}
                link={providerQueueLink(items, source.provider)}
                canDiscard={role === "admin"}
              />
            ))}
          </ul>
        )}
        {quiet.length > 0 && (
          <ul className="text-muted-foreground text-sm">
            {quiet.map((source) => (
              <li key={source.provider}>
                {source.label} · {uploadedDay(source.uploadedAt)} · {uploadChangeSummary(source)} ·
                nothing open
              </li>
            ))}
          </ul>
        )}
        {contributors !== undefined && (
          <p className="text-muted-foreground text-sm">
            Contributors and printing desk: {contributors.count}
            {contributors.since === null ? "" : ` since ${formatDayTime(contributors.since)}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
