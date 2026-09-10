import { useQuery } from "@tanstack/react-query";
import { LinkIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { CopyTextPanel } from "@/components/copy-text-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BinderSheetPanel } from "@/features/groups/components/binder-sheet-panel";
import type { ShareImagePanelProps } from "@/features/groups/components/share-image-panel";
import { ShareImagePanel } from "@/features/groups/components/share-image-panel";
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import { ShareQrPanel } from "@/features/groups/components/share-qr-panel";

export interface SharePanelLink {
  url: string | null;
  label: string;
  /** Completes "Anyone with this link can …". */
  exposes: ReactNode;
  /** The link resolves to a preview image when pasted into a chat app. */
  unfurls?: boolean;
  onCreate: () => void;
  creating?: boolean;
  onStop: () => void;
  stopping?: boolean;
}

export interface SharePanelText {
  /** Query key for the built text; include whatever makes it go stale. */
  cacheKey: readonly unknown[];
  getText: () => Promise<string>;
  description: ReactNode;
}

export interface SharePanelPrint {
  defaultTitle: string;
  defaultSubtitle: string;
  filenameHint?: string;
}

export interface SharePanelProps {
  /** "list", "collection", "deck". Fills the copy so no surface writes its own. */
  noun: string;
  link?: SharePanelLink;
  noLinkNote?: ReactNode;
  /** Surface-specific extra under the link, e.g. a pointer at a wider setting. */
  linkNote?: ReactNode;
  access?: ReactNode;
  image?: ShareImagePanelProps;
  text?: SharePanelText;
  print?: SharePanelPrint;
  /** Slugged into the QR download filename; omit on surfaces with no QR output. */
  qrFilenameBase?: string;
}

function NeedsLinkNote({ reason }: { reason: string }) {
  return <p className="text-muted-foreground text-sm">Create a share link above first. {reason}</p>;
}

function ShareTextPanel({ cacheKey, getText, description }: SharePanelText) {
  const { data, isPending } = useQuery({
    queryKey: ["share-text", ...cacheKey],
    queryFn: getText,
  });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-muted-foreground text-sm">{description}</p>
      <CopyTextPanel text={data ?? ""} label="Copy text" isLoading={isPending} />
    </div>
  );
}

/**
 * The app's one share surface: link and group access first, then
 * text/image/QR/print outputs. Renders inline on the profile and inside {@link ShareDialog} elsewhere.
 */
export function SharePanel({
  noun,
  link,
  noLinkNote,
  linkNote,
  access,
  image,
  text,
  print,
  qrFilenameBase,
}: SharePanelProps) {
  const [tab, setTab] = useState<string | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);

  const url = link?.url ?? null;

  const outputs: { value: string; label: string; body: ReactNode }[] = [];
  if (text) {
    outputs.push({ value: "text", label: "Text", body: <ShareTextPanel {...text} /> });
  }
  if (image) {
    outputs.push({ value: "image", label: "Image", body: <ShareImagePanel {...image} /> });
  }
  if (qrFilenameBase !== undefined) {
    outputs.push({
      value: "qr",
      label: "QR code",
      body:
        url === null ? (
          <NeedsLinkNote reason="The code has to point somewhere." />
        ) : (
          <ShareQrPanel
            url={url}
            label={`QR code for the ${noun} share link`}
            filenameBase={qrFilenameBase}
          />
        ),
    });
  }
  if (print) {
    outputs.push({
      value: "print",
      label: "Print",
      body:
        url === null ? (
          <NeedsLinkNote reason="The sheet carries a QR code that opens it." />
        ) : (
          <BinderSheetPanel
            shareUrl={url}
            defaultTitle={print.defaultTitle}
            defaultSubtitle={print.defaultSubtitle}
            filenameHint={print.filenameHint}
          />
        ),
    });
  }

  const activeTab = tab ?? outputs[0]?.value ?? "";

  return (
    <div className="flex flex-col gap-4">
      {link ? (
        <div className="flex flex-col gap-3">
          {url === null ? (
            <>
              <p className="text-muted-foreground text-sm">
                Create a link and anyone with it can {link.exposes}, without signing in.
              </p>
              <Button
                className="self-start"
                onClick={() => link.onCreate()}
                disabled={link.creating}
              >
                <LinkIcon />
                Create link
              </Button>
            </>
          ) : (
            <>
              <ShareLinkRow
                url={url}
                label={link.label}
                hideQr
                actions={
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmStopOpen(true)}
                    disabled={link.stopping}
                  >
                    <Trash2Icon />
                    Stop sharing
                  </Button>
                }
              />
              <p className="text-muted-foreground text-sm">
                Anyone with this link can {link.exposes}. They don&apos;t need an account.
                {link.unfurls === true
                  ? " Pasting it into WhatsApp, Discord, or Signal shows a preview image."
                  : ""}
              </p>
            </>
          )}
          {linkNote}
        </div>
      ) : (
        noLinkNote
      )}

      {access}

      {outputs.length === 0 ? null : (
        <div className="flex flex-col gap-3 border-t pt-4">
          <h3 className="font-medium">Share it as</h3>
          {outputs.length === 1 ? (
            outputs[0]?.body
          ) : (
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList>
                {outputs.map((output) => (
                  <TabsTrigger key={output.value} value={output.value}>
                    {output.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {outputs.map((output) => (
                <TabsContent key={output.value} value={output.value}>
                  {activeTab === output.value ? output.body : null}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      )}

      {link ? (
        <ConfirmActionDialog
          open={confirmStopOpen}
          onOpenChange={setConfirmStopOpen}
          title="Stop sharing?"
          description="The link stops working immediately and cannot be brought back. Anything printed with it, like a binder QR sheet, stops working too. Creating a link again later gives out a different address."
          confirmLabel="Stop sharing"
          pendingLabel="Stopping…"
          isPending={link.stopping ?? false}
          onConfirm={() => {
            link.onStop();
            setConfirmStopOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
