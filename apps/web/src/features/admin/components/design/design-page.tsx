import type { ComponentType, CSSProperties } from "react";

import { PageToc, PageTocMobileTrigger } from "@/components/layout/page-toc";
import type { PageTocItem } from "@/components/layout/page-toc";
import { PageDescription, usePageTopBarHeight } from "@/components/layout/page-top-bar";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { PAGE_WIDTH, cn } from "@/lib/utils";

import { BadgesChipsSection } from "./badges-chips-section";
import { BrandGlyphSection } from "./brand-glyph-section";
import { CardThumbnailsSection } from "./card-thumbnails-section";
import { CompositesSection } from "./composites-section";
import { ControlsSection, DESIGN_CONTROL_GROUPS } from "./controls-section";
import { FeedbackSection } from "./feedback-section";
import { FlatSectionsSection } from "./flat-sections-section";
import { FormControlsSection } from "./form-controls-section";
import { IconChipSection } from "./icon-chip-section";
import { LayoutSection } from "./layout-section";
import { MetaArchiveSection } from "./meta-archive-section";
import { OrnamentsSection } from "./ornaments-section";
import { OverlaysSection } from "./overlays-section";
import { PickersSection } from "./pickers-section";
import { PressableSection } from "./pressable-section";
import { QrCodesSection } from "./qr-codes-section";
import { SectionHeadingSection } from "./section-heading-section";
import { TextLinksSection } from "./text-links-section";
import { TilesSection } from "./tiles-section";
import { TokensSection } from "./tokens-section";
import { TopBarButtonsSection } from "./top-bar-buttons-section";

interface DesignSection {
  id: string;
  title: string;
  Component: ComponentType;
  /** Rendered under the section as level-1 TOC entries; ids must exist in the DOM. */
  groups?: readonly { id: string; title: string }[];
}

const SECTIONS: DesignSection[] = [
  { id: "tokens", title: "Tokens", Component: TokensSection },
  { id: "controls", title: "Controls", Component: ControlsSection, groups: DESIGN_CONTROL_GROUPS },
  { id: "top-bar-buttons", title: "Top-bar buttons", Component: TopBarButtonsSection },
  { id: "text-links", title: "Text links", Component: TextLinksSection },
  { id: "badges-chips", title: "Badges & chips", Component: BadgesChipsSection },
  { id: "pressable", title: "Pressable & disclosure", Component: PressableSection },
  { id: "section-heading", title: "Section heading", Component: SectionHeadingSection },
  { id: "ornaments", title: "Ornaments", Component: OrnamentsSection },
  { id: "icon-chip", title: "Icon chip", Component: IconChipSection },
  { id: "brand-glyph", title: "Brand glyph", Component: BrandGlyphSection },
  { id: "qr-codes", title: "Copy rows & QR codes", Component: QrCodesSection },
  { id: "tiles", title: "Tiles", Component: TilesSection },
  { id: "flat-sections", title: "Flat sections & lists", Component: FlatSectionsSection },
  { id: "card-thumbnails", title: "Card thumbnails", Component: CardThumbnailsSection },
  { id: "form-controls", title: "Form controls", Component: FormControlsSection },
  { id: "pickers", title: "Pickers & commands", Component: PickersSection },
  { id: "overlays", title: "Overlays", Component: OverlaysSection },
  { id: "feedback", title: "Feedback & status", Component: FeedbackSection },
  { id: "layout", title: "Layout & data", Component: LayoutSection },
  { id: "meta-archive", title: "Meta archive", Component: MetaArchiveSection },
  { id: "composites", title: "Composites", Component: CompositesSection },
];

const TOC_ITEMS: PageTocItem[] = SECTIONS.flatMap((section) => [
  { id: section.id, label: section.title },
  ...(section.groups ?? []).map((group) => ({ id: group.id, label: group.title, level: 1 })),
]);

export function DesignPage() {
  const topBarHeight = usePageTopBarHeight();

  return (
    <div
      className={cn(PAGE_WIDTH.full, "flex gap-6 pb-16")}
      style={
        { "--sticky-top": `calc(var(--header-height) + ${topBarHeight}px + 1rem)` } as CSSProperties
      }
    >
      <AdminPageTopBar title="Design" />
      <PageToc items={TOC_ITEMS} />
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <div className="flex items-start gap-3">
          <PageDescription>
            Check both themes with the header toggle. Spec captions are measured live from the
            rendered DOM.
          </PageDescription>
          <PageTocMobileTrigger items={TOC_ITEMS} className="ml-auto shrink-0" />
        </div>

        {SECTIONS.map((section) => (
          <section.Component key={section.id} />
        ))}
      </div>
    </div>
  );
}
