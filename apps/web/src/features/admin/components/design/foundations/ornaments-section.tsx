import { LayersIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { OrnamentBase, OrnamentFoldGem, OrnamentRule } from "@/components/ui/ornament";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { ClipFrame } from "@/features/marketing/components/clip-frame";

const GROUPS = {
  rules: { id: "ornaments-rules", title: "Rules" },
  base: { id: "ornaments-base", title: "Bracket base" },
  silver: { id: "ornaments-silver", title: "Silver" },
  corners: { id: "ornaments-corners", title: "Corner brackets" },
} as const;

export const DESIGN_ORNAMENTS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function OrnamentsSection() {
  return (
    <DemoSection
      id="ornaments"
      title="Ornaments"
      note="The card-border motif from the printed card text box, for the places the gold hairline already goes."
      docs="docs/design-language.md → Accents"
    >
      <DemoGroup {...GROUPS.rules}>
        <DemoRow label="Under a left-aligned heading" hint="fades both ends (default), w-40">
          <div className="flex w-full flex-col gap-4">
            <Heading level={1} as="h3">
              Switching? Bring your collection.
            </Heading>
            <OrnamentRule className="w-40" />
          </div>
        </DemoRow>
        <DemoRow label="Centered" hint="the footer and centered headings, w-56">
          <div className="flex w-full flex-col items-center gap-4">
            <Heading level={1} as="h3">
              Ready when you are.
            </Heading>
            <OrnamentRule className="w-56" />
          </div>
        </DemoRow>
        <DemoRow
          label="Labelled divider"
          hint='fade="tips" with children, the card-grid set headers'
        >
          <OrnamentRule fade="tips" className="w-full">
            <span className="flex flex-row gap-3 text-sm">
              <span className="text-muted-foreground font-medium">OGN</span>
              <span className="font-semibold">Origins</span>
            </span>
          </OrnamentRule>
        </DemoRow>
        <DemoRow
          label="Start-aligned divider"
          hint='align="start" with trailing, the deck zone headers'
        >
          <OrnamentRule
            align="start"
            fade="tips"
            className="w-full"
            leadingGem={<OrnamentFoldGem expanded />}
            trailing={<span className="text-muted-foreground text-xs tabular-nums">12/12</span>}
          >
            <SectionHeading as="span">Runes</SectionHeading>
          </OrnamentRule>
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.base}
        hint="Closes a panel that drops its bottom edge. surfaceClassName carries the panel background down to the line."
      >
        <DemoRow label="With and without a medallion icon">
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <div className="flex flex-col">
              <div className="bg-muted/30 border-border-accent rounded-t-lg border border-b-0 px-4 pt-3 pb-2">
                <p className="text-muted-foreground italic">
                  &ldquo;I am the first of many.&rdquo;
                </p>
              </div>
              <OrnamentBase surfaceClassName="bg-muted/30">
                <LayersIcon className="size-3" />
              </OrnamentBase>
            </div>
            <div className="flex flex-col">
              <div className="bg-muted/30 border-border-accent rounded-t-lg border border-b-0 px-4 pt-3 pb-2">
                <p className="font-heading text-2xl font-semibold tabular-nums">1,284</p>
              </div>
              <OrnamentBase surfaceClassName="bg-muted/30" />
            </div>
          </div>
        </DemoRow>
      </DemoGroup>
      <DemoGroup {...GROUPS.silver} hint='tone="silver" is for the black stage ground only.'>
        <DemoRow label="On the stage ground" hint="the plate matches the ground">
          <div className="dark flex w-full flex-col gap-6 rounded-lg bg-[#08090c] p-6 text-white">
            <div className="flex flex-col items-end gap-1.5">
              <span className="font-heading font-semibold">Summoner Skirmish · Top 8</span>
              <OrnamentRule tone="silver" className="w-64" />
            </div>
            <div className="flex w-64 flex-col">
              <div className="border-muted-foreground rounded-t-lg border border-b-0 bg-white/5 px-3 pt-2.5 pb-2 text-sm text-white/70">
                When another non-Recruit unit you control dies, play a Recruit unit token.
              </div>
              <OrnamentBase
                tone="silver"
                plateClassName="bg-[#08090c]"
                surfaceClassName="bg-white/5"
              />
            </div>
          </div>
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.corners}
        hint="Three chamfered corners on a ClipFrame, the corner cut stays as the fourth."
      >
        <DemoRow label="ClipFrame ornament">
          <ClipFrame ornament className="flex flex-col gap-3 p-6">
            <Heading level={1} as="h3">
              Switching? Bring your collection.
            </Heading>
            <OrnamentRule className="w-40" />
            <p className="text-muted-foreground text-sm">
              Import a CSV from Piltover Archive, RiftCore, or RiftMana.
            </p>
          </ClipFrame>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
