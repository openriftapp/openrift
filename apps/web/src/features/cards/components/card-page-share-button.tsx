import { withReferralCode } from "@openrift/shared/referral";
import { Share2Icon } from "lucide-react";
import { useState } from "react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { ShareDialog } from "@/components/share/share-dialog";
import { Button } from "@/components/ui/button";
import { useReferralCode } from "@/features/account/hooks/use-referral";
import { cardShareImageUrl } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

interface ShareCardButtonProps {
  cardName: string;
  cardSlug: string;
  printingSlug?: string;
  url: string;
}

export function ShareCardButton({ cardName, cardSlug, printingSlug, url }: ShareCardButtonProps) {
  const filenameBase = printingSlug ?? cardSlug;
  const [open, setOpen] = useState(false);
  const canNativeShare =
    open && typeof navigator !== "undefined" && typeof navigator.share === "function";

  const referralCode = useReferralCode();

  const nativeShare = async () => {
    try {
      await navigator.share({ title: cardName, url: withReferralCode(url, referralCode) });
    } catch {
      // Rejects when the viewer dismisses the sheet; the link stays copyable in the dialog.
    }
  };

  return (
    <>
      <PageTopBarButton onClick={() => setOpen(true)}>
        <Share2Icon className="size-4" />
        {m.card_detail_share()}
      </PageTopBarButton>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        title={m.card_detail_share_dialog_title({ name: cardName })}
        noun="card"
        link={{
          url,
          label: m.card_detail_share_link_aria(),
          unfurls: true,
          actions: canNativeShare ? (
            <Button variant="outline" onClick={() => void nativeShare()}>
              <Share2Icon />
              {m.card_detail_share_native()}
            </Button>
          ) : undefined,
        }}
        image={{
          title: cardName,
          filenameBase,
          buildUrl: (choice) =>
            cardShareImageUrl(getSiteUrl(), cardSlug, printingSlug, {
              size: choice.scale >= 2 ? "hq" : undefined,
              qr: choice.qr,
            }),
          aspects: ["landscape"],
          qrNoun: "card",
          qrAvailable: true,
        }}
        qrFilenameBase={filenameBase}
      />
    </>
  );
}
