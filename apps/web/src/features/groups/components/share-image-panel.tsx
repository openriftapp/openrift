import type { ShareImageAspect } from "@openrift/shared/share-image-params";
import { SHARE_IMAGE_CANVAS } from "@openrift/shared/share-image-params";
import {
  ImageDownIcon,
  Loader2Icon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ShareImageRenderChoice } from "@/lib/share-image";
import { downloadImageFromUrl } from "@/lib/share-image";
import { m } from "@/paraglide/messages.js";

/**
 * Wide renders at 2x (1200x630 is an unfurl preview, not a deliverable);
 * vertical at 1x (1080x1920 is already the native upload size).
 */
function defaultScale(aspect: ShareImageAspect, scales: readonly number[]): number {
  if (aspect === "vertical") {
    return scales.includes(1) ? 1 : (scales[0] ?? 1);
  }
  return scales.includes(2) ? 2 : (scales[0] ?? 1);
}

/** The surface being shared; picks the phrasing of the QR toggle and the share copy. */
export type ShareNoun = "lists" | "list" | "deck" | "collection" | "tier-list";

const QR_TOGGLE_LABEL: Record<ShareNoun, () => string> = {
  lists: () => m.share_image_qr_toggle_lists(),
  list: () => m.share_image_qr_toggle_list(),
  deck: () => m.share_image_qr_toggle_deck(),
  collection: () => m.share_image_qr_toggle_collection(),
  "tier-list": () => m.share_image_qr_toggle_tier_list(),
};

export interface ShareImagePanelProps {
  title: string;
  filenameBase: string;
  buildUrl: (choice: ShareImageRenderChoice) => string;
  download?: (choice: ShareImageRenderChoice, filename: string) => Promise<void>;
  aspects?: readonly ShareImageAspect[];
  scales?: readonly number[];
  /** Picks the QR label. Omitted when the render has no QR at all. */
  qrNoun?: ShareNoun;
  /** A QR needs a share link to point at; without one the render leaves it out. */
  qrAvailable?: boolean;
  note?: ReactNode;
}

/**
 * The app's one image-export surface: a live preview of the real server render
 * plus the shape / size / QR choices, ending in a Download button.
 *
 * The preview is the actual render at 1x, the same route the download hits.
 */
export function ShareImagePanel({
  title,
  filenameBase,
  buildUrl,
  download,
  aspects = ["landscape", "vertical"],
  scales = [1, 2],
  qrNoun,
  qrAvailable = false,
  note,
}: ShareImagePanelProps) {
  const [aspect, setAspect] = useState<ShareImageAspect>(aspects[0] ?? "landscape");
  const [scale, setScale] = useState(defaultScale(aspects[0] ?? "landscape", scales));
  const [qrOn, setQrOn] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const canvas = SHARE_IMAGE_CANVAS[aspect];
  const withQr = qrOn && qrAvailable;
  const showPreview = download === undefined;

  const previewUrl = buildUrl({ aspect, scale: 1, qr: withQr });

  const chooseAspect = (next: ShareImageAspect) => {
    setAspect(next);
    setScale(defaultScale(next, scales));
    setPreviewLoaded(false);
  };

  const handleDownload = async () => {
    const base = filenameBase.replaceAll(/[^\w -]+/gu, "_").trim() || "image";
    const filename = `${base}${aspect === "vertical" ? "-vertical" : ""}.png`;
    const choice: ShareImageRenderChoice = { aspect, scale, qr: withQr };
    const run =
      download === undefined
        ? downloadImageFromUrl(buildUrl(choice), filename)
        : download(choice, filename);
    setDownloading(true);
    try {
      await run;
      setDownloading(false);
    } catch {
      // Not a mutation, so it never reaches the global mutation error handler.
      // Flag reset here and above, not in `finally`: React Compiler can't lower it.
      setDownloading(false);
      toast.error(m.share_image_error());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {note}
      {showPreview ? (
        <Callout
          variant="inset"
          className="mx-auto w-full max-w-sm overflow-hidden p-0"
          style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
        >
          <img
            // Keyed on the URL so an aspect/QR change remounts and re-shows the spinner.
            key={previewUrl}
            src={previewUrl}
            alt={m.share_image_preview_alt({ title })}
            className="size-full object-contain"
            onLoad={() => setPreviewLoaded(true)}
          />
          {previewLoaded ? null : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
            </div>
          )}
        </Callout>
      ) : null}

      {aspects.length > 1 || scales.length > 1 ? (
        <div className="flex flex-wrap gap-6">
          {aspects.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label>{m.share_image_shape_label()}</Label>
              <ToggleGroup
                aria-label={m.share_image_shape_aria()}
                variant="outline"
                spacing={0}
                value={[aspect]}
                onValueChange={([next]) => {
                  if (next === "landscape" || next === "vertical") {
                    chooseAspect(next);
                  }
                }}
              >
                <ToggleGroupItem value="landscape">
                  <RectangleHorizontalIcon className="size-4" />
                  {m.share_image_shape_wide()}
                </ToggleGroupItem>
                <ToggleGroupItem value="vertical">
                  <RectangleVerticalIcon className="size-4" />
                  {m.share_image_shape_tall()}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          ) : null}

          {scales.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label>{m.share_image_size_label()}</Label>
              <ToggleGroup
                aria-label={m.share_image_size_aria()}
                variant="outline"
                spacing={0}
                value={[String(scale)]}
                onValueChange={([next]) => {
                  const picked = Number(next);
                  if (scales.includes(picked)) {
                    setScale(picked);
                  }
                }}
              >
                {scales.map((option) => (
                  <ToggleGroupItem key={option} value={String(option)}>
                    {option}×
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-muted-foreground text-sm">
                {m.share_image_dimensions({
                  width: canvas.width * scale,
                  height: canvas.height * scale,
                })}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {qrNoun === undefined ? null : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Bound to the wish, not the outcome: an unshared surface renders
                without the code and the note below says so, so creating a link
                later cannot flip a switch the user last saw off. */}
            <Switch
              id="share-image-qr"
              checked={qrOn}
              disabled={!qrAvailable}
              onCheckedChange={setQrOn}
            />
            <Label htmlFor="share-image-qr" className="font-normal">
              {QR_TOGGLE_LABEL[qrNoun]()}
            </Label>
          </div>
          {qrOn && !qrAvailable ? (
            <p className="text-muted-foreground text-sm">{m.share_image_qr_missing_link()}</p>
          ) : null}
        </div>
      )}

      <Button className="self-start" onClick={() => void handleDownload()} disabled={downloading}>
        {downloading ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            {m.share_image_preparing()}
          </>
        ) : (
          <>
            <ImageDownIcon className="size-4" />
            {m.share_image_download()}
          </>
        )}
      </Button>
    </div>
  );
}
