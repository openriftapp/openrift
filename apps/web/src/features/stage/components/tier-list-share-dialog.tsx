import { ShareDialog } from "@/features/groups/components/share-dialog";
import { useSetTierListShare } from "@/features/stage/hooks/use-tier-lists";
import { tierListOwnerImageUrl } from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";

const SCALES = [1, 2, 3];

interface TierListShareDialogProps {
  tierListId: string;
  title: string;
  isPublic: boolean;
  shareToken: string | null;
  dirty?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TierListShareDialog({
  tierListId,
  title,
  isPublic,
  shareToken,
  dirty,
  open,
  onOpenChange,
}: TierListShareDialogProps) {
  const setShare = useSetTierListShare();

  const shareUrl = shareLinkUrl("tierList", { shareToken, isPublic });

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share tier list"
      noun="tier-list"
      link={{
        url: shareUrl,
        label: "Tier list share link",
        exposes: "see the ranking and open any card for its full details",
        unfurls: true,
        onCreate: () => setShare.mutate({ id: tierListId, shared: true }),
        creating: setShare.isPending,
        onStop: () => setShare.mutate({ id: tierListId, shared: false }),
        stopping: setShare.isPending,
      }}
      image={{
        title,
        filenameBase: title || "tier-list",
        buildUrl: (choice) =>
          tierListOwnerImageUrl(getSiteUrl(), tierListId, {
            aspect: choice.aspect,
            scale: choice.scale,
            qr: choice.qr,
          }),
        scales: SCALES,
        qrNoun: "tier-list",
        qrAvailable: shareUrl !== null,
        note: dirty ? (
          <p className="text-muted-foreground text-sm">
            The image is drawn from the saved board, so save first to see your latest changes in it.
          </p>
        ) : null,
      }}
      qrFilenameBase={title || "tier-list"}
      print={{
        defaultTitle: title,
        defaultSubtitle: "Scan to see this ranking",
        filenameHint: title,
      }}
    />
  );
}
