import { useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { SharePanel } from "@/features/groups/components/share-panel";
import {
  useDisableUserShare,
  useEnableUserShare,
  useUserShareState,
} from "@/features/groups/hooks/use-user-share";
import { useSession } from "@/lib/auth-session";
import { bundleShareImageUrl, shareImageOptions } from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export function PublicSharingSection() {
  const { data, isPending } = useUserShareState();
  const { data: session } = useSession();
  const enableShare = useEnableUserShare();
  const disableShare = useDisableUserShare();
  // Stamped once per mount; stamping it in the URL builder would give the
  // preview a new URL on every render and reload the image forever.
  // oxlint-disable-next-line react/hook-use-state -- read-only, no setter needed
  const [imageVersion] = useState(() => Date.now());

  const shareToken = data?.shareToken ?? null;
  const shareUrl = shareLinkUrl("bundle", { shareToken, isPublic: shareToken !== null });

  return (
    <SettingsSection
      title={m.profile_sharing_title()}
      description={m.profile_sharing_description()}
    >
      {isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <SharePanel
          noun="lists"
          link={{
            url: shareUrl,
            label: m.profile_sharing_link_label(),
            exposes: m.profile_sharing_link_exposes(),
            unfurls: true,
            onCreate: () => enableShare.mutate(),
            creating: enableShare.isPending,
            onStop: () => disableShare.mutate(),
            stopping: disableShare.isPending,
          }}
          image={
            shareToken === null
              ? undefined
              : {
                  title: m.profile_sharing_image_title(),
                  filenameBase: "openrift-lists",
                  buildUrl: (choice) =>
                    bundleShareImageUrl(
                      getSiteUrl(),
                      shareToken,
                      imageVersion,
                      shareImageOptions(choice),
                    ),
                  scales: [1, 2],
                  qrNoun: "lists",
                  qrAvailable: true,
                }
          }
          qrFilenameBase="openrift-lists"
          print={{
            defaultTitle: session?.user?.name ?? m.profile_sharing_print_title(),
            defaultSubtitle: m.profile_sharing_print_subtitle(),
            filenameHint: "my-lists",
          }}
        />
      )}
    </SettingsSection>
  );
}
