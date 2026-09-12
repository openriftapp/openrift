import { useQuery } from "@tanstack/react-query";
import { LinkIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { CopyTextPanel } from "@/components/copy-text-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BinderSheetPanel } from "@/features/groups/components/binder-sheet-panel";
import type {
  ShareImagePanelProps,
  ShareNoun,
} from "@/features/groups/components/share-image-panel";
import { ShareImagePanel } from "@/features/groups/components/share-image-panel";
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import { ShareQrPanel } from "@/features/groups/components/share-qr-panel";
import { m } from "@/paraglide/messages.js";

const QR_LABEL: Record<ShareNoun, () => string> = {
  lists: () => m.share_qr_label_lists(),
  list: () => m.share_qr_label_list(),
  deck: () => m.share_qr_label_deck(),
  collection: () => m.share_qr_label_collection(),
  "tier-list": () => m.share_qr_label_tier_list(),
};

export const SHARE_DIALOG_DESCRIPTION: Record<ShareNoun, () => string> = {
  lists: () => m.share_dialog_description_lists(),
  list: () => m.share_dialog_description_list(),
  deck: () => m.share_dialog_description_deck(),
  collection: () => m.share_dialog_description_collection(),
  "tier-list": () => m.share_dialog_description_tier_list(),
};

interface SharePanelLink {
  url: string | null;
  label: string;
  /** Completes "Anyone with this link can …". */
  exposes: string;
  /** The link resolves to a preview image when pasted into a chat app. */
  unfurls?: boolean;
  onCreate: () => void;
  creating?: boolean;
  onStop: () => void;
  stopping?: boolean;
}

interface SharePanelText {
  /** Query key for the built text; include whatever makes it go stale. */
  cacheKey: readonly unknown[];
  getText: () => Promise<string>;
  description: ReactNode;
}

interface SharePanelPrint {
  defaultTitle: string;
  defaultSubtitle: string;
  filenameHint?: string;
}

export interface SharePanelProps {
  /** Fills the copy so no surface writes its own. */
  noun: ShareNoun;
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
  return <p className="text-muted-foreground text-sm">{m.share_needs_link({ reason })}</p>;
}

function ShareTextPanel({ cacheKey, getText, description }: SharePanelText) {
  const { data, isPending } = useQuery({
    queryKey: ["share-text", ...cacheKey],
    queryFn: getText,
  });

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-muted-foreground text-sm">{description}</p>
      <CopyTextPanel text={data ?? ""} label={m.share_copy_text()} isLoading={isPending} />
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
    outputs.push({
      value: "text",
      label: m.share_output_text(),
      body: <ShareTextPanel {...text} />,
    });
  }
  if (image) {
    outputs.push({
      value: "image",
      label: m.share_output_image(),
      body: <ShareImagePanel {...image} />,
    });
  }
  if (qrFilenameBase !== undefined) {
    outputs.push({
      value: "qr",
      label: m.share_output_qr(),
      body:
        url === null ? (
          <NeedsLinkNote reason={m.share_needs_link_qr_reason()} />
        ) : (
          <ShareQrPanel url={url} label={QR_LABEL[noun]()} filenameBase={qrFilenameBase} />
        ),
    });
  }
  if (print) {
    outputs.push({
      value: "print",
      label: m.share_output_print(),
      body:
        url === null ? (
          <NeedsLinkNote reason={m.share_needs_link_print_reason()} />
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
    <div className="flex flex-col gap-6">
      {link ? (
        <div className="flex flex-col gap-3">
          {url === null ? (
            <>
              <p className="text-muted-foreground text-sm">
                {m.share_link_create_intro({ exposes: link.exposes })}
              </p>
              <Button
                className="self-start"
                onClick={() => link.onCreate()}
                disabled={link.creating}
              >
                <LinkIcon />
                {m.share_create_link()}
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
                    {m.share_stop_sharing()}
                  </Button>
                }
              />
              <p className="text-muted-foreground text-sm">
                {m.share_link_active_note({ exposes: link.exposes })}
                {link.unfurls === true ? ` ${m.share_link_unfurl_note()}` : ""}
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
        <div className="flex flex-col gap-3">
          <h3 className="font-medium">{m.share_outputs_heading()}</h3>
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
          title={m.share_stop_confirm_title()}
          description={m.share_stop_confirm_description()}
          confirmLabel={m.share_stop_sharing()}
          pendingLabel={m.share_stop_pending()}
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
