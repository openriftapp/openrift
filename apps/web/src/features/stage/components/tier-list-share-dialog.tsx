import { ShareDialog } from "@/features/groups/components/share-dialog";
import { useSetTierListShare } from "@/features/stage/hooks/use-tier-lists";
import { tierListOwnerImageUrl } from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

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
      title={m.tier_lists_share_title()}
      noun="tier-list"
      link={{
        url: shareUrl,
        label: m.tier_lists_share_link_label(),
        exposes: m.tier_lists_share_link_exposes(),
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
          <p className="text-muted-foreground text-sm">{m.tier_lists_share_dirty_note()}</p>
        ) : null,
      }}
      qrFilenameBase={title || "tier-list"}
      print={{
        defaultTitle: title,
        defaultSubtitle: m.tier_lists_share_print_subtitle(),
        filenameHint: title,
      }}
    />
  );
}
