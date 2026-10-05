import type { candidateCardsRepo } from "../repositories/candidate-cards.js";

type Repo = ReturnType<typeof candidateCardsRepo>;

export async function buildExport(repo: Repo) {
  const [cards, printings, errataRows] = await Promise.all([
    repo.exportCards(),
    repo.exportPrintings(),
    repo.exportCardErrata(),
  ]);

  const printingsByCardId = new Map<string, typeof printings>();
  for (const p of printings) {
    const list = printingsByCardId.get(p.cardId) ?? [];
    list.push(p);
    printingsByCardId.set(p.cardId, list);
  }

  const errataByCardId = new Map(errataRows.map((e) => [e.cardId, e]));

  return cards.map((card) => {
    const errata = errataByCardId.get(card.id);
    return {
      card: {
        name: card.name,
        types: card.types,
        super_types: card.superTypes,
        domains: card.domains,
        might: card.might,
        energy: card.energy,
        power: card.power,
        might_bonus: card.mightBonus,
        rules_text: errata?.correctedRulesText ?? null,
        effect_text: errata?.correctedEffectText ?? null,
        tags: card.tags,
        short_code: card.slug,
        external_id: card.id,
        extra_data: null,
        // Curator note. Export-only — the upload side has no field for it.
        comment: card.comment,
      },
      printings: (printingsByCardId.get(card.id) ?? []).map((p) => ({
        short_code: p.shortCode,
        set_id: p.setSlug,
        set_name: p.setName,
        rarity: p.rarity,
        art_variant: p.artVariant,
        is_signed: p.isSigned,
        is_overnumbered: p.isOvernumbered,
        finish: p.finish,
        artist: p.artist,
        public_code: p.publicCode,
        printed_rules_text: p.printedRulesText,
        printed_effect_text: p.printedEffectText,
        image_url: p.originalUrl ?? p.rehostedUrl ?? null,
        flavor_text: p.flavorText,
        external_id: p.id,
        extra_data: p.imageId ? { image_id: p.imageId } : null,
        // Round-trip fidelity: these are candidate data (not admin-curated), so
        // they must survive an export → re-import cycle.
        language: p.language,
        printed_name: p.printedName,
        printed_year: p.printedYear,
        // Exported so the private candidate generators can use this document as
        // the canonical printing reference (finish enrichment keys on
        // short_code + language + markers).
        marker_slugs: p.markerSlugs,
        size: p.size,
        // Curator note. Export-only — the upload side has no field for it.
        comment: p.comment,
      })),
    };
  });
}
