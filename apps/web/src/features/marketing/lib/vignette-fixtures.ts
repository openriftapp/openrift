import { labelMap } from "@openrift/shared/enum-label";
import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import type { VariantLabelPrinting } from "@openrift/shared/printing-label";
import type { Marketplace } from "@openrift/shared/types/pricing";

import type { VignettePriceSource } from "@/features/marketing/lib/vignette-price-chart";
import { m } from "@/paraglide/messages.js";

// Vignettes must not read /init (the landing page would wait on it), so these rows mirror the
// admin-managed labels. An admin rename shows here only after this file is edited.
export const FIXTURE_LABELS = {
  zones: labelMap([
    { slug: "legend", label: "Legend" },
    { slug: "champion", label: "Champion" },
    { slug: "main", label: "Main" },
    { slug: "battlefield", label: "Battlefield" },
    { slug: "runes", label: "Runes" },
    { slug: "sideboard", label: "Sideboard" },
  ]),
  formats: labelMap([
    { slug: "constructed", label: "Constructed" },
    { slug: "freeform", label: "Freeform" },
  ]),
  rarities: labelMap([
    { slug: "common", label: "Common" },
    { slug: "uncommon", label: "Uncommon" },
    { slug: "rare", label: "Rare" },
    { slug: "epic", label: "Epic" },
    { slug: "showcase", label: "Showcase" },
  ]),
  domains: labelMap([
    { slug: "fury", label: "Fury" },
    { slug: "calm", label: "Calm" },
    { slug: "mind", label: "Mind" },
    { slug: "body", label: "Body" },
    { slug: "chaos", label: "Chaos" },
    { slug: "order", label: "Order" },
    { slug: "colorless", label: "Colorless" },
  ]),
  finishes: labelMap([
    { slug: "normal", label: "Normal" },
    { slug: "foil", label: "Foil" },
    { slug: "metal", label: "Metal" },
    { slug: "metal-deluxe", label: "Metal (Deluxe)" },
  ]),
  artVariants: labelMap([
    { slug: "normal", label: "Normal" },
    { slug: "altart", label: "Alt Art" },
    { slug: "ultimate", label: "Ultimate" },
  ]),
  cardSizes: labelMap([
    { slug: "standard", label: "Standard" },
    { slug: "oversized", label: "Oversized" },
  ]),
  languages: labelMap([{ slug: "EN", label: "English" }]),
  sets: labelMap([
    { slug: "OGN", label: "Origins" },
    { slug: "SFD", label: "Spiritforged" },
    { slug: "UNL", label: "Unleashed" },
  ]),
};

export interface FixturePerson {
  userId: string;
  userName: string;
  userImage: null;
  gravatarHash: string;
}

function person(name: string): FixturePerson {
  return {
    userId: `fixture-${name.toLowerCase()}`,
    userName: name,
    userImage: null,
    gravatarHash: "",
  };
}

export const FIXTURE_PEOPLE = {
  alice: person("Alice"),
  mira: person("Mira"),
  nour: person("Nour"),
  ravi: person("Ravi"),
  sina: person("Sina"),
  jonas: person("Jonas"),
  jax: person("Jax"),
  max: person("Max"),
} as const;

export const FIXTURE_GROUPS = {
  storeCrew: "Thursday store crew",
  riftClub: "Bothfeld Rift Club",
} as const;

export interface FixtureCard extends VariantLabelPrinting {
  name: string;
  shortCode: string;
  rarity: string;
  domains: string[];
  energy?: number;
  power?: number;
}

function fixtureCard(
  card: Pick<FixtureCard, "name" | "shortCode" | "rarity" | "domains"> & Partial<FixtureCard>,
): FixtureCard {
  return {
    language: "EN",
    artVariant: "normal",
    finish: "normal",
    size: "standard",
    isSigned: false,
    isOvernumbered: false,
    markers: [],
    ...card,
  };
}

export const FIXTURE_CARDS = {
  azir: fixtureCard({
    name: "Azir, Sovereign",
    shortCode: "SFD-177",
    rarity: "epic",
    domains: ["order"],
  }),
  azirAltArt: fixtureCard({
    name: "Azir, Sovereign",
    shortCode: "SFD-177a",
    rarity: "showcase",
    domains: ["order"],
    artVariant: "altart",
    finish: "foil",
  }),
  hiddenBlade: fixtureCard({
    name: "Hidden Blade",
    shortCode: "OGN-213",
    rarity: "common",
    domains: ["order"],
  }),
  guards: fixtureCard({
    name: "Guards!",
    shortCode: "SFD-154",
    rarity: "common",
    domains: ["order"],
  }),
  draven: fixtureCard({
    name: "Draven, Audacious",
    shortCode: "SFD-148a",
    rarity: "showcase",
    domains: ["fury"],
    artVariant: "altart",
    finish: "foil",
  }),
  yasuo: fixtureCard({
    name: "Yasuo, Windrider",
    shortCode: "OGN-205",
    rarity: "epic",
    domains: ["calm"],
    finish: "foil",
  }),
  legionRearguard: fixtureCard({
    name: "Legion Rearguard",
    shortCode: "OGN-007",
    rarity: "common",
    domains: ["fury"],
  }),
  playfulPhantom: fixtureCard({
    name: "Playful Phantom",
    shortCode: "OGN-120",
    rarity: "uncommon",
    domains: ["chaos"],
  }),
  solariShieldbearer: fixtureCard({
    name: "Solari Shieldbearer",
    shortCode: "OGN-061",
    rarity: "common",
    domains: ["calm"],
  }),
  aphelios: fixtureCard({
    name: "Aphelios, Exalted",
    shortCode: "SFD-049",
    rarity: "rare",
    domains: ["calm"],
  }),
  soulSword: fixtureCard({
    name: "Soul Sword",
    shortCode: "UNL-039",
    rarity: "common",
    domains: ["calm"],
  }),
  defy: fixtureCard({
    name: "Defy",
    shortCode: "OGN-045",
    rarity: "common",
    domains: ["calm"],
  }),
  viPeacekeeper: fixtureCard({
    name: "Vi, Peacekeeper",
    shortCode: "UNL-176",
    rarity: "rare",
    domains: ["order"],
    finish: "foil",
  }),
};

export const FIXTURE_DECK = {
  name: "Azir Order",
  formatSlug: "constructed",
} as const;

export const FIXTURE_CHAT = {
  firstViewer: "riftcaptain",
  askingViewer: "mothbite",
  query: "!card viktor innovator",
  reply: "Viktor, Innovator — Champion Unit · Mind · Energy 4 · Might 3 · Power 1 —",
  cardSlug: "viktor-innovator",
  botName: "Nightbot",
  botBadge: "BOT",
} as const;

export const FIXTURE_CARD_TYPE_LABELS = labelMap([{ slug: "unit", label: "Unit" }]);

export const FIXTURE_DESIGNED_CARD = {
  name: "Sir Pounce",
  epithet: "Lord of Naps",
  type: "unit",
  domain: "chaos",
  energy: 4,
  might: 3,
} as const;

export interface FixtureVariantDiff {
  name: string;
  kind: "add" | "cut" | "change";
  chip: string;
}

export const FIXTURE_VARIANT_RAIL = {
  root: { label: "Spiritforged", title: "Azir (Spiritforged)", updatedAt: "2026-08-11T12:00:00Z" },
  head: { label: "Unleashed", title: "Azir (Unleashed)", updatedAt: "2026-08-15T12:00:00Z" },
  fork: { label: "budget", title: "Azir (budget)", updatedAt: "2026-08-16T12:00:00Z" },
  headDiff: [
    { name: FIXTURE_CARDS.viPeacekeeper.name, kind: "add", chip: "+1" },
    { name: FIXTURE_CARDS.soulSword.name, kind: "change", chip: "2→3" },
    { name: "Xin Zhao, Vigilant", kind: "cut", chip: "−1" },
  ] satisfies FixtureVariantDiff[],
  forkDiff: [
    { name: "Trusty Ramhound", kind: "add", chip: "+3" },
    { name: "Honest Broker", kind: "add", chip: "+1" },
    { name: "Tactical Retreat", kind: "change", chip: "3→1" },
    { name: "Poppy, Defender of the Meek", kind: "cut", chip: "−2" },
  ] satisfies FixtureVariantDiff[],
};

export const FIXTURE_SHARED_DECK = {
  name: "Yasuo Aggro",
  owner: FIXTURE_PEOPLE.mira.userName,
  formatSlug: "constructed",
  cardCount: 56,
  sharePath: "/decks/share/AbCdEf123456",
  siteName: "OpenRift",
} as const;

/** The product's variant wording for a fixture printing, "Standard" when nothing sets it apart. */
export function fixtureVariantLabel(card: VariantLabelPrinting): string {
  const { rest } = formatPrintingVariantLabelParts(card, undefined, {
    ...FIXTURE_LABELS,
    flags: { overnumbered: m.cards_flag_overnumbered(), signed: m.cards_flag_signed() },
    onOneSide: (part) => m.cards_printing_part_one_side({ part }),
  });
  return rest.length > 0 ? rest.join(" · ") : m.decks_editor_printing_standard();
}

export const FIXTURE_PRICE_CARD = FIXTURE_CARDS.azir;

export const FIXTURE_PRICES = {
  cardtrader: { price: 3.65, phase: 0.6, swing: 0.9, rate: 0.02 },
  tcgplayer: { price: 4.52, phase: 2.2, swing: 1.4, rate: -0.014 },
  cardmarket: { price: 3.8, phase: 4.1, swing: 1.1, rate: 0.011 },
  cardnexus: { price: 3.95, phase: 5.3, swing: 1, rate: 0.008 },
} as const satisfies Record<Marketplace, VignettePriceSource>;

/** A collection export the real importer accepts (its Foil column decides the finish). */
export const IMPORT_SAMPLE_LINES = [
  "Variant Number,Card Name,Set,Rarity,Foil,Quantity,Language",
  "OGN-213,Hidden Blade,Origins,Common,false,4,English",
  "SFD-154,Guards!,Spiritforged,Common,true,3,English",
  'SFD-148a,"Draven, Audacious",Spiritforged,Showcase,true,2,English',
] as const;

export const IMPORT_SAMPLE_MATCHES = [
  { quantity: 4, card: { ...FIXTURE_CARDS.hiddenBlade } },
  { quantity: 3, card: { ...FIXTURE_CARDS.guards, finish: "foil" } },
  { quantity: 2, card: FIXTURE_CARDS.draven },
] as const;

export const FIXTURE_BOT = {
  askingUser: "riftcaptain",
  botName: "OpenRift",
  botBadge: "BOT",
  detailsButton: "Details",
  tradelistsHeader: (group: string) => `On tradelists in ${group}`,
  holders: (shortCode: string) => [
    { name: FIXTURE_PEOPLE.alice.userName, quantity: 2, detail: `${shortCode} 2× (Binder)` },
    {
      name: FIXTURE_PEOPLE.mira.userName,
      quantity: 2,
      detail: `${shortCode} Standard 1× (Binder) · Alt Art 1× (Trades)`,
    },
  ],
};
