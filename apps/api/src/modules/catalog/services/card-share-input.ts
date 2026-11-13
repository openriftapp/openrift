import { legendDisplayName } from "@openrift/shared/card-name";
import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { formatCents } from "@openrift/shared/money";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { CardType } from "@openrift/shared/types/enums";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";

export interface CardShareImageInput {
  cardName: string;
  typeLine: string;
  detailLine: string;
  imageId: string | null;
  otherImageIds: string[];
  printingCount: number;
  prices: { label: string; value: string }[];
  siteHost?: string;
  shareUrl?: string;
}

const CARD_SHARE_MARKETPLACES: readonly Marketplace[] = ["tcgplayer", "cardtrader"];

const MAX_OTHER_IMAGES = 4;

interface CardRow {
  name: string;
  domains: readonly string[];
  superTypes: readonly string[];
  types: readonly CardType[];
  tags: readonly string[];
}

interface PrintingRow {
  printingId: string;
  side: number;
  cardId: string;
  slug: string;
  setId: string;
  publicCode: string;
  rarity: string;
  fallbackImageId: string | null;
}

interface Labels {
  domains: LabelMap;
  superTypes: LabelMap;
  cardTypes: LabelMap;
  rarities: LabelMap;
}

export interface BuildCardShareInputArgs {
  card: CardRow & { id: string };
  printings: readonly PrintingRow[];
  images: readonly { printingId: string; side: number; imageId: string }[];
  sets: readonly { id: string; name: string }[];
  prices: readonly { printingId: string; marketplace: string; headlineCents: number }[];
  labels: Labels;
  printingSlug?: string;
  siteHost?: string;
  shareUrl?: string;
}

export function buildCardShareInput(args: BuildCardShareInputArgs): CardShareImageInput | null {
  const faces = args.printings.filter((printing) => printing.cardId === args.card.id);
  const selected =
    args.printingSlug === undefined
      ? faces[0]
      : faces.find((printing) => printing.slug === args.printingSlug);
  if (!selected) {
    return null;
  }

  const imageFor = (printing: PrintingRow): string | null =>
    args.images.find(
      (image) => image.printingId === printing.printingId && image.side === printing.side,
    )?.imageId ??
    printing.fallbackImageId ??
    null;

  const imageId = imageFor(selected);
  const otherImageIds = [
    ...new Set(faces.map((printing) => imageFor(printing)).filter((id) => id !== null)),
  ]
    .filter((id) => id !== imageId)
    .slice(0, MAX_OTHER_IMAGES);

  const { labels } = args;
  const typeLine = [
    ...args.card.domains.map((slug) => enumLabel(labels.domains, slug)),
    ...args.card.superTypes.map((slug) => enumLabel(labels.superTypes, slug)),
    ...args.card.types.map((slug) => enumLabel(labels.cardTypes, slug)),
  ].join(" ");

  const setName = args.sets.find((set) => set.id === selected.setId)?.name;
  const detailLine = [
    setName,
    formatPrintingCode(selected.publicCode),
    enumLabel(labels.rarities, selected.rarity),
  ]
    .filter((part) => part !== undefined)
    .join(" · ");

  const prices = CARD_SHARE_MARKETPLACES.flatMap((marketplace) => {
    const row = args.prices.find(
      (price) => price.printingId === selected.printingId && price.marketplace === marketplace,
    );
    return row
      ? [
          {
            label: marketplaceLabel(marketplace),
            value: formatCents(row.headlineCents, MARKETPLACE_CURRENCY[marketplace]),
          },
        ]
      : [];
  });

  return {
    cardName: legendDisplayName(args.card),
    typeLine,
    detailLine,
    imageId,
    otherImageIds,
    printingCount: new Set(faces.map((printing) => printing.printingId)).size,
    prices,
    siteHost: args.siteHost,
    shareUrl: args.shareUrl,
  };
}
