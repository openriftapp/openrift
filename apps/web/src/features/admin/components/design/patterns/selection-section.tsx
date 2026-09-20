import { useState } from "react";

import {
  SelectionMark,
  SelectionRowMark,
  SelectionStamp,
  SignetGlyph,
} from "@/components/ui/selection-mark";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";

const GROUPS = {
  card: { id: "selection-card", title: "On a card" },
  row: { id: "selection-row", title: "In a table row" },
  stamp: { id: "selection-stamp", title: "SelectionStamp" },
  glyph: { id: "selection-glyph", title: "SignetGlyph" },
} as const;

export const SELECTION_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const SAMPLE_ART = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 63 88'><defs><linearGradient id='s' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#a21caf'/><stop offset='1' stop-color='#1e1b4b'/></linearGradient></defs><rect width='63' height='88' fill='url(#s)'/><circle cx='31.5' cy='30' r='13' fill='#f472b6'/></svg>",
)}`;

function MarkedCard({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div className="relative">
      <CardArtThumb src={SAMPLE_ART} className="w-28" />
      <SelectionMark
        label="Select card"
        checked={checked}
        onCheckedChange={() => setChecked((prev) => !prev)}
      />
    </div>
  );
}

function MarkedRow({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div
      className={
        checked
          ? "bg-border-accent/15 flex w-full items-center gap-3 rounded-sm px-3 py-2"
          : "flex w-full items-center gap-3 rounded-sm px-3 py-2"
      }
    >
      <SelectionRowMark
        label="Select card"
        checked={checked}
        onCheckedChange={() => setChecked((prev) => !prev)}
      />
      <CardArtThumb shape="strip" src={SAMPLE_ART} className="h-8" />
      <div className="min-w-0">
        <div className="truncate font-medium">Jinx, Loose Cannon</div>
        <div className="text-muted-foreground text-xs tabular-nums">OGN-041</div>
      </div>
    </div>
  );
}

export function SelectionSection() {
  return (
    <DemoSection
      id="selection"
      title="Selection mode"
      note="The signet that marks a picked item, in the four forms select mode uses."
      docs="components/ui/selection-mark.tsx"
    >
      <DemoGroup
        {...GROUPS.card}
        hint="The mark carries the picked state on its own: no frame, no ring, nothing behind the tile."
      >
        <SwatchRow label="Click either one">
          <Swatch label="picked">
            <MarkedCard initial />
          </Swatch>
          <Swatch label="not picked">
            <MarkedCard initial={false} />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.row}
        hint="The mark leads the row in its own 36px track, and the picked row tints with the surface hairline tone rather than the on-art gilt."
      >
        <DemoRow label="Rows" className="flex-col items-stretch">
          <div className="flex w-full flex-col gap-1">
            <MarkedRow initial />
            <MarkedRow initial={false} />
          </div>
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.stamp}
        hint="Takes no pointer events, for a state the whole tile already toggles."
      >
        <SwatchRow label="Tones">
          <Swatch label="success">
            <div className="relative">
              <CardArtThumb src={SAMPLE_ART} className="w-28" />
              <SelectionStamp tone="success" />
            </div>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.glyph}
        hint="The shape both marks are built from, and nothing outside them uses it."
      >
        <SwatchRow label="Grounds">
          <Swatch label="surface">
            <SignetGlyph checked tone="surface" className="size-5" />
          </Swatch>
          <Swatch label="art">
            <div className="bg-foreground/80 rounded-sm p-1">
              <SignetGlyph checked className="size-5" />
            </div>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
    </DemoSection>
  );
}
