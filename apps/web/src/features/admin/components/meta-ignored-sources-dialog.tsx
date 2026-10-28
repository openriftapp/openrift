import { formatDay } from "@openrift/shared/format-date";
import { Undo2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowList, RowListItem } from "@/components/ui/row-list";
import type { IgnoredMetaSourcePlayer } from "@/features/admin/hooks/use-admin-meta-overlays";
import {
  useAdminMetaIgnoredSources,
  useUnignoreMetaSourcePlayer,
} from "@/features/admin/hooks/use-admin-meta-overlays";
import { sourceProviderDisplay } from "@/features/meta/lib/meta-source-review";

export function MetaIgnoredSourcesDialog({ onClose }: { onClose: () => void }) {
  const { data, isPending } = useAdminMetaIgnoredSources();
  const unignorePlayer = useUnignoreMetaSourcePlayer();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ignored players</DialogTitle>
          <DialogDescription>
            An ignored player is left out of one event on every refresh and upload.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
          {data?.players.length === 0 && (
            <p className="text-muted-foreground">No player is ignored.</p>
          )}
          {data !== undefined && data.players.length > 0 && (
            <RowList>
              {data.players.map((row: IgnoredMetaSourcePlayer) => (
                <RowListItem
                  key={`${row.provider}\n${row.eventExternalId}\n${row.externalId}`}
                  className="justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline">{sourceProviderDisplay(row.provider).label}</Badge>
                    <span className="truncate font-mono text-sm">
                      {row.eventExternalId} / {row.externalId}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      {formatDay(row.createdAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-2.5"
                      disabled={unignorePlayer.isPending}
                      onClick={() =>
                        unignorePlayer.mutate({
                          provider: row.provider,
                          eventExternalId: row.eventExternalId,
                          externalId: row.externalId,
                        })
                      }
                    >
                      <Undo2Icon />
                      Restore
                    </Button>
                  </div>
                </RowListItem>
              ))}
            </RowList>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
