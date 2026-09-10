import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Public sharing</CardTitle>
        <CardDescription>
          One link to all your wishlists and tradelists, current and future. Organize lists stay
          private.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <SharePanel
            noun="lists"
            link={{
              url: shareUrl,
              label: "Bundle share link",
              exposes: "see every wishlist and tradelist you have",
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
                    title: "your shared lists",
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
              defaultTitle: session?.user?.name ?? "My lists",
              defaultSubtitle: "Scan to see my wish & tradelists",
              filenameHint: "my-lists",
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
