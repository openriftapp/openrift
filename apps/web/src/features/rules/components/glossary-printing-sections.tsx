import { Link } from "@tanstack/react-router";

import { RowList } from "@/components/ui/row-list";
import { TextLink } from "@/components/ui/text-link";
import {
  artVariantDescription,
  finishDescription,
  packSlots,
  printingDetails,
} from "@/features/rules/lib/glossary-content";
import { matches } from "@/features/rules/lib/glossary-search";
import { getFilterIconPath } from "@/lib/icons";
import { m } from "@/paraglide/messages.js";

import { GlossarySectionHeading, GlossaryTermRow, GlossaryTermTile } from "./glossary-shared";

export function RaritiesSection({
  rarities,
  query,
}: {
  rarities: { slug: string; label: string; color?: string | null }[];
  query: string;
}) {
  const visible = rarities.filter((rarity) => matches(query, rarity.label, rarity.slug));
  if (visible.length === 0) {
    return null;
  }
  const withImage = new Set(["common", "uncommon", "rare", "epic", "showcase"]);
  return (
    <section>
      <GlossarySectionHeading id="rarities" title={m.glossary_section_rarities()} />
      <p className="text-muted-foreground mt-2">{m.glossary_rarities_intro()}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((rarity) => {
          const slug = rarity.slug.toLowerCase();
          const rarityIcon = getFilterIconPath("rarities", rarity.slug);
          return (
            <GlossaryTermTile key={rarity.slug} className="flex-row items-center gap-3">
              {withImage.has(slug) && rarityIcon && (
                <img
                  src={rarityIcon}
                  alt={rarity.label}
                  width={28}
                  height={28}
                  className="size-7 shrink-0"
                />
              )}
              <span className="font-medium" style={rarity.color ? { color: rarity.color } : {}}>
                {rarity.label}
              </span>
            </GlossaryTermTile>
          );
        })}
      </ul>
    </section>
  );
}

export function BoosterPacksSection({ query }: { query: string }) {
  const visible = packSlots().filter((slot) => matches(query, slot.label, slot.description));
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="booster-packs" title={m.glossary_section_booster_packs()} />
      <p className="text-muted-foreground mt-2">
        {m.glossary_booster_intro_before()}{" "}
        <TextLink render={<Link to="/pack-opener" />}>
          {m.glossary_booster_pack_opener_link()}
        </TextLink>{" "}
        {m.glossary_booster_intro_after()}
      </p>
      <RowList className="mt-4">
        {visible.map((slot) => (
          <GlossaryTermRow key={slot.key} term={slot.label}>
            <p className="text-muted-foreground flex-1">{slot.description}</p>
          </GlossaryTermRow>
        ))}
      </RowList>
      <p className="text-muted-foreground mt-3">{m.glossary_booster_rates_note()}</p>
    </section>
  );
}

export function ArtVariantsSection({
  artVariants,
  query,
}: {
  artVariants: { slug: string; label: string }[];
  query: string;
}) {
  const visible = artVariants.filter((variant) => {
    const description = artVariantDescription(variant.slug.toLowerCase());
    return matches(query, variant.label, variant.slug, description);
  });
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="art-variants" title={m.glossary_section_art_variants()} />
      <p className="text-muted-foreground mt-2">{m.glossary_art_variants_intro()}</p>
      <RowList className="mt-4">
        {visible.map((variant) => (
          <GlossaryTermRow key={variant.slug} term={variant.label}>
            <p className="text-muted-foreground flex-1">
              {artVariantDescription(variant.slug.toLowerCase()) ?? ""}
            </p>
          </GlossaryTermRow>
        ))}
      </RowList>
    </section>
  );
}

export function FinishesSection({
  finishes,
  query,
}: {
  finishes: { slug: string; label: string }[];
  query: string;
}) {
  const visible = finishes.filter((finish) => {
    const description = finishDescription(finish.slug.toLowerCase());
    return matches(query, finish.label, finish.slug, description);
  });
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="finishes" title={m.glossary_section_finishes()} />
      <p className="text-muted-foreground mt-2">{m.glossary_finishes_intro()}</p>
      <RowList className="mt-4">
        {visible.map((finish) => (
          <GlossaryTermRow key={finish.slug} term={finish.label}>
            <p className="text-muted-foreground flex-1">
              {finishDescription(finish.slug.toLowerCase()) ?? ""}
            </p>
          </GlossaryTermRow>
        ))}
      </RowList>
    </section>
  );
}

export function MarkersSection({
  markers,
  query,
}: {
  markers: { slug: string; label: string; description: string | null }[];
  query: string;
}) {
  const visible = markers.filter((marker) =>
    matches(query, marker.label, marker.slug, marker.description ?? undefined),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="markers" title={m.glossary_section_markers()} />
      <p className="text-muted-foreground mt-2">{m.glossary_markers_intro()}</p>
      <RowList className="mt-4">
        {visible.map((marker) => (
          <GlossaryTermRow key={marker.slug} term={marker.label}>
            <p className="text-muted-foreground flex-1">
              {marker.description ?? (
                <span className="italic">{m.glossary_marker_no_description()}</span>
              )}
            </p>
          </GlossaryTermRow>
        ))}
      </RowList>
    </section>
  );
}

export function PrintingDetailsSection({ query }: { query: string }) {
  const visible = printingDetails().filter((item) => matches(query, item.label, item.description));
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading
        id="artist-and-signature"
        title={m.glossary_section_artist_signature()}
      />
      <p className="text-muted-foreground mt-2">{m.glossary_printing_details_intro()}</p>
      <RowList className="mt-4">
        {visible.map((item) => (
          <GlossaryTermRow key={item.key} term={item.label}>
            <p className="text-muted-foreground flex-1">{item.description}</p>
          </GlossaryTermRow>
        ))}
      </RowList>
    </section>
  );
}
