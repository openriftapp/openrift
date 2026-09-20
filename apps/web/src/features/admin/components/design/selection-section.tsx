import { useState } from "react";

import {
  SelectionMark,
  SelectionRowMark,
  SelectionStamp,
  SignetGlyph,
} from "@/components/ui/selection-mark";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";

import { DemoRow, DemoSection, Swatch } from "./demo-primitives";

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
      title="Selection"
      note="The signet is the picked mark for select mode: a struck disc with a rim, its echo and a check, sized against the card it sits on. SelectionMark centres it on the image (collection and list grids); SelectionRowMark is the control-sized version for a table row, which tints as well. Both are checkboxes, so the role and the label are unchanged. The mark carries the state on its own: no frame, no ring, nothing behind the tile. SelectionStamp is the same disc without the control, for a state the whole tile already toggles: the deck check uses it in success green over a dimmed card. The selection bar itself is FloatingActionBar, which is fixed to the viewport and so has no demo here."
    >
      <DemoRow
        label="On a card"
        hint="Click either one. Unpicked is the same disc, smaller and empty; the target stays visible so select mode reads as such."
      >
        <Swatch label="picked">
          <MarkedCard initial />
        </Swatch>
        <Swatch label="not picked">
          <MarkedCard initial={false} />
        </Swatch>
      </DemoRow>
      <DemoRow
        label="In a table row"
        hint="The mark leads the row in its own 36px track, and the picked row tints. Gold here is the surface hairline tone, not the on-art gilt."
      >
        <div className="flex w-full flex-col gap-1">
          <MarkedRow initial />
          <MarkedRow initial={false} />
        </div>
      </DemoRow>
      <DemoRow
        label="As a stamp"
        hint="SelectionStamp takes no pointer events, so it neither steals the card's hover nor adds a second control. The deck check stamps found cards with it."
      >
        <Swatch label="success">
          <div className="relative">
            <CardArtThumb src={SAMPLE_ART} className="w-28" />
            <SelectionStamp tone="success" />
          </div>
        </Swatch>
      </DemoRow>
      <DemoRow
        label="As an icon"
        hint="SignetGlyph on its own, the shape both marks are built from. Nothing outside them uses it; the top bar keeps its own icons."
      >
        <Swatch label="surface">
          <SignetGlyph checked tone="surface" className="size-5" />
        </Swatch>
        <Swatch label="art">
          <div className="bg-foreground/80 rounded-sm p-1">
            <SignetGlyph checked className="size-5" />
          </div>
        </Swatch>
      </DemoRow>
    </DemoSection>
  );
}
