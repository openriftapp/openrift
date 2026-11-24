import { WellKnown } from "@openrift/shared/well-known";
import { useState } from "react";

import type { ExportAction } from "@/features/cards/lib/card-export";
import { CARD_EXPORT_WIDTH, exportCardImage } from "@/features/cards/lib/card-export";
import { typeIconColor } from "@/features/cards/lib/card-face";
import { BackgroundImageControl } from "@/features/designer/components/background-image-control";
import { CardDesignerForm } from "@/features/designer/components/card-designer-form";
import { CardDesignerPreview } from "@/features/designer/components/card-designer-preview";
import { CardExportControls } from "@/features/designer/components/card-export-controls";
import { frameUrlFor } from "@/features/designer/lib/card-designer";
import type { DesignerCard } from "@/features/designer/stores/card-designer-store";
import { useCardDesignerStore } from "@/features/designer/stores/card-designer-store";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { getPipGlyphTint } from "@/lib/domain";
import { downloadFilename } from "@/lib/download";
import { createRenderHandoff } from "@/lib/html-capture";
import { getFilterIconPath, getTypeIconPath, glyphPath } from "@/lib/icons";
import { useConstant } from "@/lib/use-constant";
import { prewarmTintedIcons, TINT_BLACK, TINT_WHITE } from "@/lib/white-icon";
import { m } from "@/paraglide/messages.js";

/**
 * Pre-tints the glyph icons before the export clone is captured: html2canvas
 * can't apply the CSS color filters.
 */
function designerTintedIcons(
  card: DesignerCard,
  showFrame: boolean,
  domainColors: Record<string, string>,
): { src: string; color: string }[] {
  const white = new Set<string>();
  for (const domain of card.domains) {
    const path = getFilterIconPath("domains", domain);
    if (path) {
      white.add(path);
    }
  }
  white.add("/images/artist.svg");
  white.add("/logo.svg");

  const icons = [...white].map((src) => ({ src, color: TINT_WHITE }));
  const typeIcon = card.type ? getTypeIconPath(card.type, card.superTypes) : undefined;
  if (typeIcon) {
    icons.push({ src: typeIcon, color: typeIconColor(card.rarity) });
  }
  const framed = showFrame && frameUrlFor(card) !== null;
  // The might shield's symbol is black on its white left half.
  if (card.might !== null || framed) {
    icons.push({ src: "/images/might.svg", color: TINT_BLACK });
  }
  if (framed) {
    icons.push(
      { src: glyphPath("might"), color: TINT_BLACK },
      { src: glyphPath("exhaust"), color: TINT_BLACK },
    );
  }
  // Power pip rune tint must contrast with the domain background (black on order/body domains); see CardPlaceholderImage.
  if (card.power !== null && card.power > 0) {
    const runeSrc =
      card.domains.length > 1
        ? "/images/glyphs/rune-rainbow.svg"
        : getFilterIconPath("domains", card.domains[0] ?? WellKnown.domain.COLORLESS);
    if (runeSrc) {
      const tint =
        getPipGlyphTint(card.domains, domainColors) === "black" ? TINT_BLACK : TINT_WHITE;
      icons.push({ src: runeSrc, color: tint });
    }
  }
  return icons;
}

const CLONE_KEY = "designer-export";

export function CardDesignerPage() {
  const cardName = useCardDesignerStore((state) => state.card.name);
  const showFrame = useCardDesignerStore((state) => state.showFrame);
  const framed = useCardDesignerStore((state) => frameUrlFor(state.card) !== null);
  const domainColors = useDomainColors();
  const cloneHandoff = useConstant(createRenderHandoff);
  const [renderClone, setRenderClone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function runExport(action: ExportAction) {
    if (busy) {
      return;
    }
    setStatus(null);
    setBusy(true);
    // Tint the white glyph icons before rendering the clone, so its synchronous
    // render finds them cached (html2canvas ignores the CSS white filter).
    await prewarmTintedIcons(
      designerTintedIcons(useCardDesignerStore.getState().card, showFrame, domainColors),
    );
    setRenderClone(true);
    const element = await cloneHandoff.waitFor(CLONE_KEY);
    const filename = `${downloadFilename({ base: cardName, fallback: "riftbound-card" })}.png`;
    const outcome = await exportCardImage(element, action, filename).catch(() => null);
    setRenderClone(false);
    setBusy(false);
    if (outcome === "copied") {
      setStatus(m.designer_export_status_copied());
    } else if (outcome === "downloaded") {
      setStatus(
        action === "copy"
          ? m.designer_export_status_clipboard_unavailable()
          : m.designer_export_status_downloaded(),
      );
    } else {
      setStatus(m.designer_export_status_failed());
    }
  }

  return (
    <>
      {/* grid-cols-1 matters: without it the implicit column sizes to the
          form's widest row and the whole page clips past a phone viewport. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <CardDesignerForm />
        </div>
        <div className="order-1 flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">
          <CardDesignerPreview interactive className="w-full" />
          {!framed && (
            <p className="text-muted-foreground text-sm">{m.designer_frame_unavailable()}</p>
          )}
          <BackgroundImageControl />
          <CardExportControls
            onDownload={() => void runExport("download")}
            onCopy={() => void runExport("copy")}
            busy={busy}
            status={status}
          />
        </div>
      </div>
      {renderClone && (
        <div
          ref={(element) => cloneHandoff.report(CLONE_KEY, element)}
          aria-hidden="true"
          style={{
            position: "fixed",
            left: -99_999,
            top: 0,
            width: CARD_EXPORT_WIDTH,
            pointerEvents: "none",
          }}
        >
          <CardDesignerPreview forExport />
        </div>
      )}
    </>
  );
}
