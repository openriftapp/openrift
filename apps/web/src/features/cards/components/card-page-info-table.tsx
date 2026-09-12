import { enumLabel } from "@openrift/shared/enum-label";
import type { CardDetailResponse } from "@openrift/shared/types/api/catalog";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import { PaletteIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment } from "react";

import { LanguageChip } from "@/components/language-chip";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { FinishIcon } from "@/features/cards/components/finish-icon";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { formatPublicCode } from "@/lib/format";
import { getFilterIconPath, getTypeIconPaths } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type InfoTableRow = [string, ReactNode];

export function CardPageInfoTable({
  card,
  printing,
  sets,
}: {
  card: CardDetailResponse["card"];
  printing: Printing;
  sets: CardDetailResponse["sets"];
}) {
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const setById = new Map(sets.map((s) => [s.id, s]));

  const leftRows: InfoTableRow[] = [
    [
      m.card_detail_info_set(),
      <Link
        key="set"
        to="/sets/$setSlug"
        params={{ setSlug: printing.setSlug }}
        className="hover:text-foreground underline decoration-dotted underline-offset-2"
      >
        {printing.setSlug.toUpperCase()}
        {setById.get(printing.setId) && ` (${setById.get(printing.setId)?.name})`}
      </Link>,
    ],
    [m.card_detail_info_code(), formatPublicCode(printing)],
  ];
  if (printing.printedName && printing.printedName !== card.name) {
    leftRows.push([m.card_detail_info_printed_name(), printing.printedName]);
  }
  leftRows.push([
    m.card_detail_info_language(),
    <span key="language" className="inline-flex items-center gap-1.5">
      <LanguageChip code={printing.language} />
      {languageLabels[printing.language] ?? printing.language}
    </span>,
  ]);
  const rarityIcon = getFilterIconPath("rarities", printing.rarity);
  leftRows.push(
    [
      m.card_detail_info_rarity(),
      <span key="rarity" className="inline-flex items-center gap-1.5">
        <span className="inline-flex w-4 shrink-0 justify-center">
          {rarityIcon && <img src={rarityIcon} alt="" width={28} height={28} className="size-4" />}
        </span>
        {enumLabel(labels.rarities, printing.rarity)}
      </span>,
    ],
    [
      m.card_detail_info_finish(),
      <span key="finish" className="inline-flex items-center gap-1.5">
        <FinishIcon finish={printing.finish} className="w-4 shrink-0 justify-center" />
        {enumLabel(labels.finishes, printing.finish)}
      </span>,
    ],
  );
  if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
    leftRows.push([
      m.card_detail_info_art_variant(),
      <span key="art" className="inline-flex items-center gap-1">
        <PaletteIcon className="size-3.5" />
        {enumLabel(labels.artVariants, printing.artVariant)}
      </span>,
    ]);
  }
  if (printing.isOvernumbered) {
    leftRows.push([
      m.card_detail_info_numbering(),
      <span key="overnumbered">{m.card_detail_info_overnumbered()}</span>,
    ]);
  }
  if (printing.artist) {
    leftRows.push([
      m.card_detail_info_artist(),
      <span key="artist" className="inline-flex items-center gap-1.5">
        <span className="inline-flex w-4 shrink-0 justify-center">
          <img src="/images/artist.svg" alt="" className="size-3.5 brightness-0 dark:invert" />
        </span>
        {printing.artist}
      </span>,
    ]);
  }
  if (printing.printedYear !== null) {
    leftRows.push([m.card_detail_info_year(), printing.printedYear]);
  }

  const rightRows: InfoTableRow[] = [
    [
      m.card_detail_info_type(),
      <TypeValue
        key="type"
        types={card.types}
        typeLabel={card.types.map((slug) => enumLabel(labels.cardTypes, slug)).join(" ")}
        superTypes={card.superTypes}
      />,
    ],
  ];
  if (card.superTypes.length > 0) {
    rightRows.push([
      m.card_detail_info_supertypes(),
      card.superTypes.map((slug) => enumLabel(labels.superTypes, slug)).join(", "),
    ]);
  }
  if (card.domains.length > 0 && !card.domains.includes(WellKnown.domain.COLORLESS)) {
    rightRows.push([
      m.card_detail_info_domains(),
      <DomainList key="domains" domains={card.domains} labels={labels.domains} />,
    ]);
  }
  if (card.energy !== null && card.energy > 0) {
    rightRows.push([m.card_detail_info_energy(), card.energy]);
  }
  if (card.power !== null && card.power > 0) {
    rightRows.push([
      m.card_detail_info_power(),
      <PowerValue key="power" power={card.power} domains={card.domains} />,
    ]);
  }
  if (card.might !== null) {
    rightRows.push([m.card_detail_info_might(), <MightValue key="might" value={card.might} />]);
  }
  if (card.mightBonus !== null && card.mightBonus > 0) {
    rightRows.push([
      m.card_detail_info_might_bonus(),
      <MightValue key="mightbonus" value={card.mightBonus} bonus />,
    ]);
  }

  return (
    <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
      <InfoList rows={leftRows} />
      <InfoList rows={rightRows} />
    </div>
  );
}

function InfoList({ rows }: { rows: InfoTableRow[] }) {
  return (
    <DefinitionList className="grid-cols-[6rem_minmax(0,1fr)] content-start">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <DefinitionTerm>{label}</DefinitionTerm>
          <DefinitionDetail>{value}</DefinitionDetail>
        </Fragment>
      ))}
    </DefinitionList>
  );
}

function TypeValue({
  types,
  typeLabel,
  superTypes,
}: {
  types: string[];
  typeLabel: string;
  superTypes: string[];
}) {
  const iconPaths = getTypeIconPaths(types, superTypes);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex w-4 shrink-0 justify-center gap-0.5">
        {iconPaths.map((path) => (
          <img key={path} src={path} alt="" className="size-4 brightness-0 dark:invert" />
        ))}
      </span>
      {typeLabel}
    </span>
  );
}

function DomainList({ domains, labels }: { domains: string[]; labels: Record<string, string> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {domains.map((domain) => {
        const iconPath = getFilterIconPath("domains", domain);
        return (
          <span key={domain} className="inline-flex items-center gap-1">
            {iconPath && <img src={iconPath} alt="" width={64} height={64} className="size-4" />}
            {labels[domain]}
          </span>
        );
      })}
    </span>
  );
}

function MightValue({ value, bonus = false }: { value: number; bonus?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1", bonus && "font-semibold")}>
      <img src="/images/might.svg" alt="" className="size-4 brightness-0 dark:invert" />
      {bonus ? `+${value}` : value}
    </span>
  );
}

function PowerValue({ power, domains }: { power: number; domains: string[] }) {
  const primaryDomain = domains[0] ?? WellKnown.domain.COLORLESS;
  const iconPath = getFilterIconPath("domains", primaryDomain);
  if (!iconPath) {
    return <span>{power}</span>;
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: power }, (_, index) => (
        <img key={index} src={iconPath} alt="" className="size-4" />
      ))}
    </span>
  );
}
