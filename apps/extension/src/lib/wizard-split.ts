import { formatEuro } from "./cardmarket-annotate";
import type { CardmarketFinish } from "./cardmarket-rows";

export interface WizardLine {
  /** The seller card the line sits in; shipping is per seller. */
  seller: string;
  idProduct: number;
  finish: CardmarketFinish;
  idLanguage: number | null;
  languageLabel: string | null;
  productName: string;
  quantity: number;
  /** The wizard's asking price per copy. */
  cardmarketCents: number;
  /** Cheapest CardTrader Zero listing per copy, null when the snapshot has none. */
  cardtraderCents: number | null;
}

/** Shipping per seller as the wizard estimates it; undefined where the card shows none. */
export type SellerShipping = ReadonlyMap<string, number | undefined>;

export interface SellerDecision {
  seller: string;
  /** Whether any card is still bought from this seller. */
  kept: boolean;
  shippingCents: number | undefined;
  /** What the seller's Cardmarket-cheaper cards save against CardTrader, before shipping. */
  savingCents: number;
  unpriced: number;
  cardmarket: WizardLine[];
  cardtrader: WizardLine[];
}

export type Winner = "cardmarket" | "cardtrader" | "split";

export interface WizardTotalsCents {
  /** Undefined while a seller's shipping is unknown. */
  cardmarket: number | undefined;
  /** Undefined while a card has no CardTrader price. */
  cardtrader: number | undefined;
  split: number | undefined;
}

export interface WizardSplit {
  /** Lines to buy on Cardmarket, following the winner. */
  cardmarket: WizardLine[];
  /** Lines to buy on CardTrader, following the winner. */
  cardtrader: WizardLine[];
  sellers: SellerDecision[];
  /** The cheapest of the three ways, undefined when no way has a full total. */
  winner: Winner | undefined;
  countZeroShipping: boolean;
  totals: WizardTotalsCents;
  unpriced: number;
  /** What the wizard asks for every line. */
  wizardCents: number;
  /** Every priced line at CardTrader's price; the unpriced ones are not in it. */
  cardtraderAllCents: number;
  /** The seller-split's Cardmarket lines at the wizard's price. */
  cardmarketCents: number;
  /** The seller-split's CardTrader lines at CardTrader's price. */
  cardtraderCents: number;
}

const ENGLISH_LANGUAGE_ID = 1;

// CardTrader Zero to Germany, cheapest service per weight tier, as listed on
// cardtrader.com/en/shipping_methods/zero on 2026-09-13. Cards per tier are CardTrader's own estimate.
const ZERO_SHIPPING_DE: readonly { upToCards: number; cents: number }[] = [
  { upToCards: 494, cents: 1890 },
  { upToCards: 1494, cents: 2640 },
  { upToCards: 2494, cents: 5430 },
  { upToCards: Number.POSITIVE_INFINITY, cents: 8440 },
];

/** One CardTrader Zero fee for an order of that many cards. */
export function cardtraderZeroShippingCents(cardCount: number): number {
  const tier = ZERO_SHIPPING_DE.find((candidate) => cardCount <= candidate.upToCards);
  return tier?.cents ?? 0;
}

function lineCents(line: WizardLine, cents: number): number {
  return cents * line.quantity;
}

function sumCents(lines: readonly WizardLine[], pick: (line: WizardLine) => number): number {
  return lines.reduce((sum, line) => sum + lineCents(line, pick(line)), 0);
}

export function lineCount(lines: readonly WizardLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * One seller at a time: the cards cheaper on CardTrader leave, and the rest stay only
 * while what they save covers the seller's shipping. A card with no CardTrader price
 * pins the seller, so their shipping is paid anyway and every cheaper card stays too.
 * A tie counts as cheaper here.
 */
function decideSeller(
  seller: string,
  lines: readonly WizardLine[],
  shippingCents: number | undefined,
): SellerDecision {
  const cheaperOnCardtrader = lines.filter(
    (line) => line.cardtraderCents !== null && line.cardtraderCents < line.cardmarketCents,
  );
  const staying = lines.filter((line) => !cheaperOnCardtrader.includes(line));
  const unpriced = staying.filter((line) => line.cardtraderCents === null).length;
  const savingCents = sumCents(
    staying.filter((line) => line.cardtraderCents !== null),
    (line) => (line.cardtraderCents ?? 0) - line.cardmarketCents,
  );
  const pinned = unpriced > 0 || shippingCents === undefined;
  const kept = staying.length > 0 && (pinned || savingCents > shippingCents);
  return {
    seller,
    kept,
    shippingCents,
    savingCents,
    unpriced,
    cardmarket: kept ? staying : [],
    cardtrader: kept ? cheaperOnCardtrader : [...lines],
  };
}

/** Sums the shipping of the given sellers; unknown as soon as one of them has no figure. */
function shippingFor(decisions: readonly SellerDecision[]): number | undefined {
  let cents: number | undefined = 0;
  for (const decision of decisions) {
    cents =
      cents === undefined || decision.shippingCents === undefined
        ? undefined
        : cents + decision.shippingCents;
  }
  return cents;
}

function plus(...parts: (number | undefined)[]): number | undefined {
  let sum = 0;
  for (const part of parts) {
    if (part === undefined) {
      return undefined;
    }
    sum += part;
  }
  return sum;
}

function knownTotals(totals: WizardTotalsCents): [Winner, number][] {
  return (Object.entries(totals) as [Winner, number | undefined][])
    .filter((entry): entry is [Winner, number] => entry[1] !== undefined)
    .toSorted((a, b) => a[1] - b[1]);
}

/**
 * Splits per seller, totals the three ways to buy, and hands out the lists of the
 * cheapest. With the Zero fee counted a small CardTrader side can cost more than it
 * saves, and then everything stays on Cardmarket.
 */
export function splitWizardLines(
  lines: readonly WizardLine[],
  shipping: SellerShipping = new Map(),
  countZeroShipping = false,
): WizardSplit {
  const sellers = [...Map.groupBy(lines, (line) => line.seller)].map(([seller, own]) =>
    decideSeller(seller, own, shipping.get(seller)),
  );
  const splitCardmarket = sellers.flatMap((decision) => decision.cardmarket);
  const splitCardtrader = sellers.flatMap((decision) => decision.cardtrader);
  const priced = lines.filter((line) => line.cardtraderCents !== null);
  const unpriced = lines.length - priced.length;
  const zeroFee = (count: number) =>
    countZeroShipping && count > 0 ? cardtraderZeroShippingCents(count) : 0;

  const wizardCents = sumCents(lines, (line) => line.cardmarketCents);
  const cardtraderAllCents = sumCents(priced, (line) => line.cardtraderCents ?? 0);
  const cardmarketCents = sumCents(splitCardmarket, (line) => line.cardmarketCents);
  const cardtraderCents = sumCents(splitCardtrader, (line) => line.cardtraderCents ?? 0);

  const totals: WizardTotalsCents = {
    cardmarket: plus(wizardCents, shippingFor(sellers)),
    cardtrader: unpriced === 0 ? plus(cardtraderAllCents, zeroFee(lineCount(lines))) : undefined,
    split: plus(
      cardmarketCents,
      cardtraderCents,
      shippingFor(sellers.filter((decision) => decision.kept)),
      zeroFee(lineCount(splitCardtrader)),
    ),
  };
  const winner = knownTotals(totals)[0]?.[0];

  return {
    cardmarket:
      winner === "cardmarket" ? [...lines] : winner === "cardtrader" ? [] : splitCardmarket,
    cardtrader:
      winner === "cardtrader" ? [...lines] : winner === "cardmarket" ? [] : splitCardtrader,
    sellers,
    winner,
    countZeroShipping,
    totals,
    unpriced,
    wizardCents,
    cardtraderAllCents,
    cardmarketCents,
    cardtraderCents,
  };
}

/** The wants format Cardmarket's wizard reads back: quantity, name, one per line, merged by name. */
export function wantsText(lines: readonly WizardLine[]): string {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.productName, (merged.get(line.productName) ?? 0) + line.quantity);
  }
  return [...merged.entries()]
    .toSorted((a, b) => a[0].localeCompare(b[0]))
    .map(([name, quantity]) => `${quantity}x ${name}`)
    .join("\n");
}

/** A wants list carries no finish or language, so a moved foil or non-English line needs a word. */
export function needsAttributeNote(lines: readonly WizardLine[]): boolean {
  return lines.some(
    (line) =>
      line.finish === "foil" ||
      (line.idLanguage !== null && line.idLanguage !== ENGLISH_LANGUAGE_ID),
  );
}

function cards(count: number): string {
  return `${count} card${count === 1 ? "" : "s"}`;
}

function sellersLabel(count: number): string {
  return `${count} seller${count === 1 ? "" : "s"}`;
}

/** One line under a seller's card: the decision and what it rests on. */
export function sellerSummaryText(
  decision: SellerDecision,
  winner: Winner | undefined,
  locale?: string,
): string {
  const total = decision.cardmarket.length + decision.cardtrader.length;
  if (total === 0) {
    return "";
  }
  if (winner === "cardmarket") {
    return "Whole order stays on Cardmarket: CardTrader would not come out cheaper.";
  }
  if (winner === "cardtrader") {
    return "Whole order goes to CardTrader: cheaper than the sellers here with their shipping.";
  }
  const shipping =
    decision.shippingCents === undefined
      ? "unknown shipping"
      : `${formatEuro(decision.shippingCents, locale)} shipping`;
  if (!decision.kept) {
    const there = formatEuro(
      sumCents(decision.cardtrader, (line) => line.cardtraderCents ?? 0),
      locale,
    );
    return `Skip this seller: all ${cards(total)} on CardTrader for ${there}. Keeping the cheaper ones here would save ${formatEuro(decision.savingCents, locale)} against ${shipping}.`;
  }
  const moved =
    decision.cardtrader.length === 0
      ? ""
      : ` ${cards(decision.cardtrader.length)} cheaper on CardTrader, moved.`;
  if (decision.unpriced > 0) {
    return `Keep ${cards(decision.cardmarket.length)} here: ${cards(decision.unpriced)} with no CardTrader price.${moved}`;
  }
  return `Keep ${cards(decision.cardmarket.length)} here: they save ${formatEuro(decision.savingCents, locale)} against ${shipping}.${moved}`;
}

export interface WizardTotals {
  allCardmarket: string;
  allCardtrader: string;
  best: string;
  unpriced: string | undefined;
}

function cardmarketPart(
  articlesCents: number,
  count: number,
  sellers: number,
  shippingCents: number | undefined,
  locale?: string,
): string {
  const amount = formatEuro(articlesCents, locale);
  if (sellers === 0) {
    return `${amount} for ${cards(count)}`;
  }
  const from = `from ${sellersLabel(sellers)}`;
  const fee =
    shippingCents === undefined
      ? ` plus shipping ${from}`
      : ` + ${formatEuro(shippingCents, locale)} shipping ${from}`;
  return `${amount}${fee} for ${cards(count)}`;
}

function cardtraderPart(
  articlesCents: number,
  coverage: string,
  count: number,
  countZeroShipping: boolean,
  locale?: string,
): string {
  const shipping =
    countZeroShipping && count > 0
      ? ` + ${formatEuro(cardtraderZeroShippingCents(count), locale)} Zero shipping`
      : "";
  return `${formatEuro(articlesCents, locale)}${shipping} for ${coverage}`;
}

function equals(cents: number | undefined, locale?: string): string {
  return cents === undefined ? "" : ` = ${formatEuro(cents, locale)}`;
}

const WINNER_NAME: Record<Winner, string> = {
  cardmarket: "all on Cardmarket",
  cardtrader: "all on CardTrader",
  split: "a mix",
};

/**
 * The verdict: the cheapest way, its distance to the runner-up, and for a mix its
 * composition. A mix never beats one shop by less than nothing: the winner is picked
 * among all three, so this line is never above either extreme.
 */
function bestText(split: WizardSplit, kept: readonly SellerDecision[], locale?: string): string {
  const [first, ...rest] = knownTotals(split.totals);
  if (first === undefined) {
    return "Best: not decidable, a shipping figure is missing.";
  }
  // A mix that collapses into one shop shares its total; the margin is to the next distinct one.
  const runnerUp = rest.find((candidate) => candidate[1] !== first[1]);
  const margin =
    runnerUp === undefined
      ? ""
      : `, ${formatEuro(runnerUp[1] - first[1], locale)} under ${WINNER_NAME[runnerUp[0]]}`;
  if (first[0] !== "split") {
    return `Best: ${WINNER_NAME[first[0]]}${margin}.`;
  }
  const cardmarketCount = lineCount(split.cardmarket);
  const cardtraderCount = lineCount(split.cardtrader);
  return `Best: a mix${margin}. Cardmarket ${cardmarketPart(split.cardmarketCents, cardmarketCount, kept.length, shippingFor(kept), locale)}, CardTrader ${cardtraderPart(split.cardtraderCents, cards(cardtraderCount), cardtraderCount, split.countZeroShipping, locale)}${equals(split.totals.split, locale)}.`;
}

/** The figures for the result summary, shipping included where it is known. */
export function totalsText(split: WizardSplit, locale?: string): WizardTotals {
  const every = [...split.cardmarket, ...split.cardtrader];
  const all = lineCount(every);
  const unpricedCards = lineCount(every.filter((line) => line.cardtraderCents === null));
  const kept = split.sellers.filter((decision) => decision.kept);
  const coverage = split.unpriced === 0 ? cards(all) : `${all - unpricedCards} of ${cards(all)}`;
  const zero = split.countZeroShipping;

  return {
    allCardmarket: `All on Cardmarket: ${cardmarketPart(split.wizardCents, all, split.sellers.length, shippingFor(split.sellers), locale)}${equals(split.totals.cardmarket, locale)}`,
    allCardtrader: `All on CardTrader: ${cardtraderPart(split.cardtraderAllCents, coverage, all, zero, locale)}${equals(split.totals.cardtrader, locale)}`,
    best: bestText(split, kept, locale),
    unpriced:
      split.unpriced === 0
        ? undefined
        : `${cards(split.unpriced)} without a CardTrader price, counted on the Cardmarket side.`,
  };
}
