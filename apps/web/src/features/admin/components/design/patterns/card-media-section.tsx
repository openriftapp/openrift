import { CoverBand } from "@/components/cover-band";
import {
  DemoGroup,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { CardFan, CardFanOutline } from "@/features/cards/components/card-fan";
import { CardMiniRow } from "@/features/cards/components/card-mini-row";

const GROUPS = {
  thumb: { id: "card-media-thumb", title: "CardArtThumb" },
  empty: { id: "card-media-empty", title: "Empty states" },
  miniRow: { id: "card-media-mini-row", title: "CardMiniRow" },
  fan: { id: "card-media-fan", title: "CardFan" },
  stack: { id: "card-media-stack", title: "CardArtThumbStack" },
} as const;

export const CARD_MEDIA_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const PORTRAIT_SAMPLE_ART = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 63 88'><defs><linearGradient id='p' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#6366f1'/><stop offset='1' stop-color='#0ea5e9'/></linearGradient></defs><rect width='63' height='88' fill='url(#p)'/><circle cx='31.5' cy='26' r='10' fill='#fde047'/><text x='31.5' y='58' font-family='sans-serif' font-size='8' font-weight='bold' fill='white' text-anchor='middle'>UNIT</text></svg>",
)}`;

const LANDSCAPE_SAMPLE_ART = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 63'><defs><linearGradient id='l' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#059669'/><stop offset='1' stop-color='#84cc16'/></linearGradient></defs><rect width='88' height='63' fill='url(#l)'/><text x='44' y='37' font-family='sans-serif' font-size='9' font-weight='bold' fill='white' text-anchor='middle'>BATTLEFIELD</text></svg>",
)}`;

export function CardMediaSection() {
  return (
    <DemoSection
      id="card-media"
      title="Card media"
      note="The image-only card frames a list row, a tile or a cover reaches for."
      docs="features/cards/components/card-art-thumb.tsx"
    >
      <DemoGroup {...GROUPS.thumb}>
        <SwatchRow
          label="Shapes"
          hint="Same art throughout. card locks to the portrait card ratio, strip crops portrait art to its illustration band, and square crops the top where the splash is."
        >
          <Swatch label="card">
            <CardArtThumb src={PORTRAIT_SAMPLE_ART} className="h-14" />
          </Swatch>
          <Swatch label="strip">
            <CardArtThumb shape="strip" src={PORTRAIT_SAMPLE_ART} className="h-14" />
          </Swatch>
          <Swatch label="square">
            <CardArtThumb shape="square" src={PORTRAIT_SAMPLE_ART} className="h-14" />
          </Swatch>
        </SwatchRow>
        <SwatchRow
          label="Sizes"
          hint="Set a width or a height and the shape's aspect ratio keeps the other axis."
        >
          <Swatch label="h-8">
            <CardArtThumb src={PORTRAIT_SAMPLE_ART} className="h-8" />
          </Swatch>
          <Swatch label="h-10">
            <CardArtThumb src={PORTRAIT_SAMPLE_ART} className="h-10" />
          </Swatch>
          <Swatch label="h-14">
            <CardArtThumb src={PORTRAIT_SAMPLE_ART} className="h-14" />
          </Swatch>
          <Swatch label="w-16">
            <CardArtThumb src={PORTRAIT_SAMPLE_ART} className="w-16" />
          </Swatch>
        </SwatchRow>
        <SwatchRow
          label="Strip sizes"
          hint="h-6 is the default and the deck list's size, and rows that carry more text step up."
        >
          <Swatch label="h-6 (default)">
            <CardArtThumb shape="strip" src={PORTRAIT_SAMPLE_ART} />
          </Swatch>
          <Swatch label="h-8">
            <CardArtThumb shape="strip" src={PORTRAIT_SAMPLE_ART} className="h-8" />
          </Swatch>
          <Swatch label="h-10">
            <CardArtThumb shape="strip" src={PORTRAIT_SAMPLE_ART} className="h-10" />
          </Swatch>
        </SwatchRow>
        <SwatchRow
          label="Battlefield art"
          hint="A card frame has to rotate landscape art by -90° to fill it, while a strip is already the art's own ratio and fills edge to edge untouched."
        >
          <Swatch label="card, no prop">
            <CardArtThumb src={LANDSCAPE_SAMPLE_ART} className="h-14" />
          </Swatch>
          <Swatch label="card + landscape">
            <CardArtThumb src={LANDSCAPE_SAMPLE_ART} landscape className="h-14" />
          </Swatch>
          <Swatch label="strip + landscape">
            <CardArtThumb shape="strip" src={LANDSCAPE_SAMPLE_ART} landscape className="h-14" />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.empty}
        hint="Shown when no image resolves and when an image fails to load, and every shape shares the one fallback chain."
      >
        <SwatchRow label="No art on file">
          <Swatch label="generic">
            <CardArtThumb imageId={null} className="h-14" />
          </Swatch>
          <Swatch label="rarity watermark">
            <CardArtThumb imageId={null} rarity="showcase" className="h-14" />
          </Swatch>
          <Swatch label="domain tint">
            <CardArtThumb imageId={null} rarity="showcase" domains={["chaos"]} className="h-14" />
          </Swatch>
          <Swatch label="strip">
            <CardArtThumb
              shape="strip"
              imageId={null}
              rarity="showcase"
              domains={["chaos"]}
              className="h-14"
            />
          </Swatch>
          <Swatch label="square">
            <CardArtThumb
              shape="square"
              imageId={null}
              rarity="showcase"
              domains={["chaos"]}
              className="h-14"
            />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.miniRow}
        hint="Everything after the art is opt-in, so pass only what the row has data for."
      >
        <SwatchRow label="Row lead">
          <Swatch label="art only">
            <CardMiniRow src={PORTRAIT_SAMPLE_ART} />
          </Swatch>
          <Swatch label="+ domain bar">
            <CardMiniRow src={PORTRAIT_SAMPLE_ART} domains={["chaos"]} />
          </Swatch>
          <Swatch label="dual domain">
            <CardMiniRow src={PORTRAIT_SAMPLE_ART} domains={["fury", "calm"]} />
          </Swatch>
          <Swatch label="full cluster">
            <CardMiniRow
              src={PORTRAIT_SAMPLE_ART}
              domains={["chaos"]}
              rarity="showcase"
              shortCode="OGN-042"
            />
          </Swatch>
          <Swatch label="battlefield">
            <CardMiniRow
              src={LANDSCAPE_SAMPLE_ART}
              landscape
              domains={["order"]}
              rarity="showcase"
              shortCode="OGN-118"
            />
          </Swatch>
          <Swatch label="no art on file">
            <CardMiniRow imageId={null} domains={["fury"]} rarity="showcase" shortCode="OGN-007" />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.fan}
        hint="CardFanOutline is the no-art stand-in, and anchor=center floats the fan mid-band for a taller hero."
      >
        <SwatchRow label="On CoverBand">
          <Swatch label="xs / center">
            <CoverBand aria-hidden="true" className="h-28 w-56 overflow-hidden rounded-lg">
              <CardFan
                size="xs"
                anchor="center"
                covers={[
                  { key: "a", src: PORTRAIT_SAMPLE_ART },
                  { key: "b", src: PORTRAIT_SAMPLE_ART },
                  { key: "c", src: PORTRAIT_SAMPLE_ART },
                ]}
              />
            </CoverBand>
          </Swatch>
          <Swatch label="sm / bottom">
            <CoverBand aria-hidden="true" className="h-36 w-72 overflow-hidden rounded-lg">
              <CardFan
                covers={[
                  { key: "a", src: PORTRAIT_SAMPLE_ART },
                  { key: "b", src: PORTRAIT_SAMPLE_ART },
                  { key: "c", src: PORTRAIT_SAMPLE_ART },
                ]}
              />
            </CoverBand>
          </Swatch>
          <Swatch label="outline">
            <CoverBand aria-hidden="true" className="h-36 w-72 overflow-hidden rounded-lg">
              <CardFanOutline />
            </CoverBand>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup {...GROUPS.stack}>
        <SwatchRow label="Overflow">
          <Swatch label="3 items">
            <CardArtThumbStack
              items={Array.from({ length: 3 }, (_, index) => ({
                key: `s${index}`,
                src: PORTRAIT_SAMPLE_ART,
              }))}
            />
          </Swatch>
          <Swatch label="8 items, max 5">
            <CardArtThumbStack
              items={Array.from({ length: 8 }, (_, index) => ({
                key: `m${index}`,
                src: PORTRAIT_SAMPLE_ART,
              }))}
            />
          </Swatch>
          <Swatch label="thumbClassName=w-10">
            <CardArtThumbStack
              thumbClassName="w-10"
              items={Array.from({ length: 4 }, (_, index) => ({
                key: `l${index}`,
                src: PORTRAIT_SAMPLE_ART,
              }))}
            />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
    </DemoSection>
  );
}
