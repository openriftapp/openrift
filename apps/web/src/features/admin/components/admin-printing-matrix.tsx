import { enumLabel } from "@openrift/shared/enum-label";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";
import { PaletteIcon, TagIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { CardIcon } from "@/components/card-icon";
import { LanguageChip } from "@/components/language-chip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Pressable } from "@/components/ui/pressable";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { usePrintingsByLanguage } from "@/features/admin/hooks/use-printings-by-language";
import { groupAdminPrintingDesigns } from "@/features/admin/lib/card-overview";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { FinishIcon, hasFinishIcon } from "@/features/cards/components/finish-icon";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";

const cellGrid =
  "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(var(--cols),4.5rem)]";

export function AdminPrintingMatrix({
  detail,
  landscape,
  onOpen,
}: {
  detail: AdminCardDetailResponse;
  landscape: boolean;
  onOpen: (printingId: string) => void;
}) {
  const byLanguage = usePrintingsByLanguage(detail.printings);
  const { languages, designs } = groupAdminPrintingDesigns(
    byLanguage.flatMap((group) => group.printings),
  );
  const columns = { "--cols": languages.length } as CSSProperties;

  return (
    <div className="bg-card overflow-hidden rounded-xl border" style={columns}>
      <div className="flex px-3 py-2 sm:px-4">
        <span className="hidden flex-1 sm:block" />
        <div className={cn(cellGrid, "flex-1 sm:flex-none")}>
          {languages.map((language) => (
            <span key={language} className="flex justify-center">
              <LanguageChip code={language} />
            </span>
          ))}
        </div>
      </div>
      <ul>
        {designs.map((design) => (
          <li
            key={design.key}
            className="flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2"
          >
            <DesignInfo design={design} />
            <div className={cellGrid}>
              {languages.map((language) => {
                const printing = design.byLanguage.get(language);
                if (!printing) {
                  return (
                    <span key={language} className="flex justify-center py-1">
                      <span
                        aria-hidden
                        className="aspect-card w-11 border border-dashed"
                        style={{ borderRadius: CARD_BORDER_RADIUS }}
                      />
                    </span>
                  );
                }
                return (
                  <PrintingCell
                    key={language}
                    printing={printing}
                    detail={detail}
                    landscape={landscape}
                    onOpen={onOpen}
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrintingCell({
  printing,
  detail,
  landscape,
  onOpen,
}: {
  printing: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  landscape: boolean;
  onOpen: (printingId: string) => void;
}) {
  const image = imagesOnSide(detail.printingImages, printing).find(
    (candidate) => candidate.isActive,
  );
  const url = image === undefined ? null : printingImageDisplayUrl(image);
  const thumb = (
    <CardArtThumb
      src={url}
      landscape={landscape}
      rarity={printing.rarity}
      className="w-11"
      loading="lazy"
    />
  );

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Pressable
            aria-label={`${printing.shortCode}, ${printing.language}`}
            className="hover:bg-muted/50 flex justify-center rounded-md py-1 transition-colors"
            onClick={() => onOpen(printing.id)}
          />
        }
      >
        {thumb}
      </HoverCardTrigger>
      {url && (
        <HoverCardContent side="right" className="w-auto p-1">
          <img
            src={url}
            alt=""
            className="max-h-[70vh] max-w-[min(40rem,80vw)] rounded-md object-contain"
          />
        </HoverCardContent>
      )}
    </HoverCard>
  );
}

function DesignInfo({ design }: { design: PrintingDesign<AdminPrintingResponse> }) {
  const printing = design.lead;
  const { labels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const markerLabels = Object.fromEntries(
    markersData.markers.map((marker) => [marker.slug, marker.label]),
  );

  const badges: ReactNode[] = [
    <span key="rarity" className="text-muted-foreground inline-flex items-center gap-0.5 text-xs">
      <RarityIcon rarity={printing.rarity} className="size-3" />
      {enumLabel(labels.rarities, printing.rarity)}
    </span>,
    <span key="finish" className="inline-flex items-center gap-0.5 text-xs">
      {hasFinishIcon(printing.finish) && (
        <FinishIcon finish={printing.finish} iconClassName="size-3" />
      )}
      {enumLabel(labels.finishes, printing.finish)}
    </span>,
  ];
  if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
    badges.push(
      <span key="art" className="text-muted-foreground inline-flex items-center gap-0.5 text-xs">
        <PaletteIcon className="size-3" />
        {enumLabel(labels.artVariants, printing.artVariant)}
      </span>,
    );
  }
  if (printing.markerSlugs.length > 0) {
    badges.push(
      <span
        key="markers"
        className="text-muted-foreground inline-flex items-center gap-0.5 text-xs"
      >
        <TagIcon className="size-3" />
        {printing.markerSlugs.map((slug) => enumLabel(markerLabels, slug)).join(", ")}
      </span>,
    );
  }
  if (printing.size !== WellKnown.cardSize.STANDARD) {
    badges.push(
      <span key="size" className="text-muted-foreground text-xs">
        {enumLabel(labels.cardSizes, printing.size)}
      </span>,
    );
  }
  if (printing.side === 2) {
    badges.push(
      <span key="side" className="text-muted-foreground text-xs">
        Back face
      </span>,
    );
  }
  if (printing.otherFace) {
    badges.push(
      <span key="other-face" className="text-muted-foreground text-xs">
        Paired with {printing.otherFace.cardName}
      </span>,
    );
  }
  if (printing.isOvernumbered) {
    badges.push(
      <span key="overnumbered" className="text-muted-foreground text-xs">
        Overnumbered
      </span>,
    );
  }
  if (printing.isSigned) {
    badges.push(
      <span key="signed" className="text-muted-foreground text-xs">
        Signed
      </span>,
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold">{printing.shortCode}</p>
        {badges}
      </div>
      {printing.artist && (
        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <CardIcon src="/images/artist.svg" className="size-3 shrink-0" />
          <span className="truncate">{printing.artist}</span>
        </p>
      )}
    </div>
  );
}
