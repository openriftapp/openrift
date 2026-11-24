import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";
import { PaletteIcon, TagIcon } from "lucide-react";
import { Fragment, isValidElement } from "react";
import type { CSSProperties, ReactNode } from "react";

import { CardIcon } from "@/components/card-icon";
import { LanguageChip } from "@/components/language-chip";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Pressable } from "@/components/ui/pressable";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { usePrintingsByLanguage } from "@/features/admin/hooks/use-printings-by-language";
import {
  groupAdminFaceDesigns,
  groupAdminPrintingDesigns,
} from "@/features/admin/lib/card-overview";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { FinishIcon, hasFinishIcon } from "@/features/cards/components/finish-icon";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { PrintingDesign } from "@/features/cards/lib/printing-designs";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";

const NO_GHOSTS: readonly MatrixGhost[] = [];

const cellGrid =
  "grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(var(--cols),var(--cell,4.5rem))]";

/** A printing a source proposes, drawn where it would join the grid. */
export interface MatrixGhost {
  key: string;
  shortCode: string;
  language: string;
  summary: string;
  imageUrl: string | null;
  action: ReactNode;
}

const PAIRED_THUMB = "max-w-11 flex-1";

export function AdminPrintingMatrix({
  detail,
  landscape,
  onOpen,
  faces,
  printings,
  highlightedIds,
  ghosts = NO_GHOSTS,
  onlyShortCodes,
}: {
  detail: AdminCardDetailResponse;
  landscape: boolean;
  onOpen: (printingId: string) => void;
  faces?: readonly AdminPrintingResponse[];
  printings?: readonly AdminPrintingResponse[];
  highlightedIds?: ReadonlySet<string>;
  ghosts?: readonly MatrixGhost[];
  onlyShortCodes?: ReadonlySet<string>;
}) {
  const byLanguage = usePrintingsByLanguage(faces ?? printings ?? detail.printings);
  const ordered = byLanguage.flatMap((group) => group.printings);
  const grouped =
    faces === undefined ? groupAdminPrintingDesigns(ordered) : groupAdminFaceDesigns(ordered);
  const languages = [
    ...grouped.languages,
    ...new Set(
      ghosts.map((ghost) => ghost.language).filter((code) => !grouped.languages.includes(code)),
    ),
  ];
  const designs =
    onlyShortCodes === undefined
      ? grouped.designs
      : grouped.designs.filter((design) => onlyShortCodes.has(design.lead.shortCode));
  const lastWithCode = new Map(designs.map((design) => [design.lead.shortCode, design.key]));
  const ghostsAfter = Map.groupBy(ghosts, (ghost) => lastWithCode.get(ghost.shortCode) ?? null);
  const ghostRows = (list: readonly MatrixGhost[] | undefined) =>
    list?.map((ghost) => <GhostRow key={ghost.key} ghost={ghost} languages={languages} />);
  const columns: MatrixColumns =
    faces === undefined ? (printings === undefined ? "flow" : "printing") : "face";
  const paired = printings?.some((printing) => printing.otherFace !== null) === true;
  const columnCount = {
    "--cols": languages.length,
    ...(paired ? { "--cell": "7rem" } : {}),
  } as CSSProperties;

  return (
    <div className="bg-card @container overflow-hidden rounded-xl border" style={columnCount}>
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
          <Fragment key={design.key}>
            <li className="flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2">
              <DesignInfo design={design} columns={columns} />
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
                      highlighted={highlightedIds?.has(printing.id) === true}
                      bothFaces={columns === "printing"}
                    />
                  );
                })}
              </div>
            </li>
            {ghostRows(ghostsAfter.get(design.key))}
          </Fragment>
        ))}
        {ghostRows(ghostsAfter.get(null))}
      </ul>
    </div>
  );
}

function GhostRow({ ghost, languages }: { ghost: MatrixGhost; languages: readonly string[] }) {
  return (
    <li className="border-primary bg-muted/40 flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant="warning">New</Badge>
        <p className="font-semibold">{ghost.shortCode}</p>
        <span className="text-muted-foreground text-xs">{ghost.summary}</span>
        {ghost.action}
      </div>
      <div className={cellGrid}>
        {languages.map((language) => (
          <span key={language} className="flex justify-center py-1">
            {language === ghost.language ? (
              <span className="border-primary rounded-sm border-2 border-dashed p-0.5">
                <CardArtThumb src={ghost.imageUrl} className="w-10" loading="lazy" />
              </span>
            ) : (
              <span
                aria-hidden
                className="aspect-card w-11 border border-dashed"
                style={{ borderRadius: CARD_BORDER_RADIUS }}
              />
            )}
          </span>
        ))}
      </div>
    </li>
  );
}

function PrintingCell({
  printing,
  detail,
  landscape,
  onOpen,
  highlighted,
  bothFaces,
}: {
  printing: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  landscape: boolean;
  onOpen: (printingId: string) => void;
  highlighted: boolean;
  bothFaces: boolean;
}) {
  const image = imagesOnSide(detail.printingImages, printing).find(
    (candidate) => candidate.isActive,
  );
  const url = image === undefined ? null : printingImageDisplayUrl(image);
  const pairs = bothFaces && printing.otherFace !== null;
  const own = (
    <CardArtThumb
      src={url}
      landscape={landscape}
      rarity={printing.rarity}
      className={pairs ? PAIRED_THUMB : "w-11"}
      loading="lazy"
    />
  );
  const other = pairs && (
    <CardArtThumb
      src={printing.otherFace?.imageUrl}
      landscape={landscape}
      rarity={printing.rarity}
      className={PAIRED_THUMB}
      loading="lazy"
    />
  );
  const thumb = other ? (
    <span className="flex w-full justify-center gap-0.5">
      {printing.side === 1 ? own : other}
      {printing.side === 1 ? other : own}
    </span>
  ) : (
    own
  );

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Pressable
            aria-label={
              highlighted
                ? `${printing.shortCode}, ${printing.language}, has pending work`
                : `${printing.shortCode}, ${printing.language}`
            }
            className={cn(
              "hover:bg-muted/50 flex justify-center rounded-md py-1 transition-colors",
              highlighted && "bg-warning-soft ring-warning ring-2",
            )}
            onClick={() => onOpen(printing.id)}
          />
        }
      >
        {thumb}
      </HoverCardTrigger>
      {url && (
        <HoverCardContent side="right" className="w-auto p-1">
          <ImgWithFallback
            src={url}
            alt=""
            className="max-h-[70vh] max-w-[min(40rem,80vw)] rounded-md object-contain"
            fallback={<span className="text-muted-foreground block p-2">Image failed to load</span>}
          />
        </HoverCardContent>
      )}
    </HoverCard>
  );
}

type MatrixColumns = "flow" | "face" | "printing";

function DesignInfo({
  design,
  columns,
}: {
  design: PrintingDesign<AdminPrintingResponse>;
  columns: MatrixColumns;
}) {
  const faceOnly = columns === "face";
  const printing = design.lead;
  const { labels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const markerLabels = labelMap(markersData.markers);

  const badges: ReactNode[] = [
    <span key="rarity" className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <RarityIcon rarity={printing.rarity} className="size-3" />
      {enumLabel(labels.rarities, printing.rarity)}
    </span>,
    <span key="finish" className="inline-flex items-center gap-1 text-xs">
      {hasFinishIcon(printing.finish) && (
        <FinishIcon finish={printing.finish} iconClassName="size-3" />
      )}
      {enumLabel(labels.finishes, printing.finish)}
    </span>,
  ];
  if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
    badges.push(
      <span key="art" className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <PaletteIcon className="size-3" />
        {enumLabel(labels.artVariants, printing.artVariant)}
      </span>,
    );
  }
  if (printing.markerSlugs.length > 0) {
    badges.push(
      <span key="markers" className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <TagIcon className="size-3" />
        {printing.markerSlugs.map((slug) => enumLabel(markerLabels, slug)).join(", ")}
      </span>,
    );
  }
  if (!faceOnly && printing.size !== WellKnown.cardSize.STANDARD) {
    badges.push(
      <span key="size" className="text-muted-foreground text-xs">
        {enumLabel(labels.cardSizes, printing.size)}
      </span>,
    );
  }
  if (!faceOnly && printing.side === 2) {
    badges.push(
      <span key="side" className="text-muted-foreground text-xs">
        Back face
      </span>,
    );
  }
  if (!faceOnly && printing.otherFace) {
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

  if (columns === "printing") {
    const cell = (key: string) =>
      badges.find((badge) => isValidElement(badge) && badge.key === key) ?? (
        <span className="hidden @5xl:block" />
      );
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 @5xl:grid @5xl:grid-cols-[6.5rem_4.5rem_5rem_5rem_10rem_minmax(0,1fr)]">
        <p className="font-semibold">{printing.shortCode}</p>
        {cell("finish")}
        {cell("markers")}
        {cell("size")}
        {cell("other-face")}
        <span className="text-muted-foreground text-xs">
          {printing.distributionChannelSlugs.join(", ")}
        </span>
      </div>
    );
  }

  if (faceOnly) {
    const cell = (key: string) =>
      badges.find((badge) => isValidElement(badge) && badge.key === key) ?? (
        <span className="hidden @5xl:block" />
      );
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 @5xl:grid @5xl:grid-cols-[6.5rem_6rem_4.5rem_5rem_minmax(0,1fr)]">
        <p className="font-semibold">{printing.shortCode}</p>
        {cell("rarity")}
        {cell("finish")}
        {cell("art")}
        {cell("markers")}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold">{printing.shortCode}</p>
        {badges}
      </div>
      {!faceOnly && printing.artist && (
        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <CardIcon src="/images/artist.svg" className="size-3 shrink-0" />
          <span className="truncate">{printing.artist}</span>
        </p>
      )}
    </div>
  );
}
