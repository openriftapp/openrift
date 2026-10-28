import type { AdminMetaEventSource } from "@openrift/shared/types/api/meta";
import { LinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SourceCitationsEditor } from "@/features/admin/components/source-citations-editor";
import {
  useAdminMetaEventSources,
  useCreateMetaEventSource,
  useDeleteMetaEventSource,
} from "@/features/admin/hooks/use-admin-meta";
import { sourceProviderDisplay } from "@/features/meta/lib/meta-source-review";

// No provider field: a citation is keyed by (provider, external_id) and owned by its candidate's link.
export function MetaEventSourcesEditor({ eventId }: { eventId: string }) {
  const { data, isPending } = useAdminMetaEventSources(eventId);
  const createSource = useCreateMetaEventSource();
  const deleteSource = useDeleteMetaEventSource();

  const sources: AdminMetaEventSource[] = data?.sources ?? [];

  return (
    <SourceCitationsEditor
      citations={sources}
      isPending={isPending}
      description={
        <>
          Every source the public event page credits. Mirrored sources are linked when the event is
          published. Add the others here.
        </>
      }
      emptyText="No source links yet, so the event page shows no source line."
      labelPlaceholder="Twitch VOD"
      creating={createSource.isPending}
      deleting={deleteSource.isPending}
      onAdd={(input) => createSource.mutateAsync({ eventId, ...input })}
      onDelete={(sourceId) => deleteSource.mutate({ eventId, sourceId })}
      renderBadge={(citation) =>
        citation.provider === null ? null : (
          <Badge variant="neutral">
            <LinkIcon className="size-3" />
            {sourceProviderDisplay(citation.provider).label}
          </Badge>
        )
      }
      lockedReason={(citation) => (citation.provider === null ? null : "Mirrored source")}
    />
  );
}
