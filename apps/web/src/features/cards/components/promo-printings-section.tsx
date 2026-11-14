import { countPrintings, sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import { PromoCardThumbnail } from "@/features/cards/components/promo-card-thumbnail";
import { PromoChannelIntro } from "@/features/cards/components/promo-channel-intro";
import { PromoListView } from "@/features/cards/components/promo-list-view";
import { ParentAnchors, SectionDivider } from "@/features/cards/components/promo-section-divider";
import type { RenderedSectionProps } from "@/features/cards/components/promo-section-grid";

export function PromoPrintingsSection({
  sectionId,
  title,
  printings,
  description,
  parentAnchorIds,
  showChannel,
  stickyOffset,
  viewMode,
  showImages,
  display,
  grid,
  onCardClick,
  ownedCounts,
  sortPrintings,
  setNameBySlug,
}: {
  sectionId: string;
  title: string;
  printings: Printing[];
  description?: string | null;
  parentAnchorIds?: string[];
  showChannel?: boolean;
} & RenderedSectionProps) {
  const sortedPrintings = sortPrintings(printings);
  if (sortedPrintings.length === 0) {
    return null;
  }
  return (
    <section id={sectionId} style={{ scrollMarginTop: `${stickyOffset}px` }}>
      {parentAnchorIds && <ParentAnchors ids={parentAnchorIds} stickyOffset={stickyOffset} />}
      <SectionDivider
        title={title}
        count={countPrintings(sortedPrintings)}
        intro={description && <PromoChannelIntro description={description} />}
        anchorId={sectionId}
      />
      {viewMode === "grid" ? (
        <div {...grid}>
          {sortedPrintings.map((printing) => (
            <PromoCardThumbnail
              key={sideKey(printing)}
              printing={printing}
              showImages={showImages}
              display={display}
              ownedCounts={ownedCounts}
              onClick={onCardClick}
            />
          ))}
        </div>
      ) : (
        <PromoListView
          printings={sortedPrintings}
          onRowClick={onCardClick}
          ownedCounts={ownedCounts}
          setNameBySlug={setNameBySlug}
          showChannel={showChannel}
        />
      )}
    </section>
  );
}
