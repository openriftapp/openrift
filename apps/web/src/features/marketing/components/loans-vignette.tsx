import { enumLabel } from "@openrift/shared/enum-label";
import { ChevronRightIcon, EllipsisVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CardRow } from "@/components/ui/card-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import type { FixtureCard } from "@/features/marketing/lib/vignette-fixtures";
import {
  FIXTURE_CARDS,
  FIXTURE_LABELS,
  FIXTURE_PEOPLE,
  fixtureVariantLabel,
} from "@/features/marketing/lib/vignette-fixtures";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ClipFrame } from "./clip-frame";
import { Swap } from "./vignette-parts";

interface LoanCard {
  quantity: number;
  card: FixtureCard;
  counterparty: string;
}

// RarityIcon reads the enum labels from /init, so the meta line rebuilds it from the icon path.
function MetaLine({ card }: { card: FixtureCard }) {
  const rarityIcon = getFilterIconPath("rarities", card.rarity);
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      {rarityIcon && (
        <img
          src={rarityIcon}
          alt={enumLabel(FIXTURE_LABELS.rarities, card.rarity)}
          className="size-3.5"
        />
      )}
      <span>
        <span className="font-mono">{card.shortCode}</span> · {fixtureVariantLabel(card)}
      </span>
    </span>
  );
}

function LoanRow({ loan, trailing }: { loan: LoanCard; trailing: ReactNode }) {
  return (
    <CardRow className="flex-col items-stretch justify-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:contents">
        <CardArtThumb
          shape="strip"
          rarity={loan.card.rarity}
          domains={loan.card.domains}
          className="h-10"
          loading="lazy"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">
            {m.loans_quantity({ count: loan.quantity, card: loan.card.name })}
          </span>
          <MetaLine card={loan.card} />
        </div>
        <span className="flex shrink-0 items-center gap-1.5 px-1.5 py-1">
          <UserAvatar name={loan.counterparty} size="sm" />
          <span className="text-sm">{m.loans_to_person({ name: loan.counterparty })}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 sm:contents">
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">{trailing}</div>
      </div>
    </CardRow>
  );
}

function MarkReturned({ pressing }: { pressing?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          buttonVariants({ size: "sm" }),
          pressing && "motion-safe:animate-loans-press",
        )}
      >
        {m.loans_mark_returned()}
      </span>
      <span
        aria-hidden="true"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <EllipsisVerticalIcon />
      </span>
    </>
  );
}

const YASUO: LoanCard = {
  quantity: 2,
  card: FIXTURE_CARDS.yasuo,
  counterparty: FIXTURE_PEOPLE.mira.userName,
};

const HIDDEN_BLADE: LoanCard = {
  quantity: 1,
  card: FIXTURE_CARDS.hiddenBlade,
  counterparty: FIXTURE_PEOPLE.jax.userName,
};

const GUARDS: LoanCard = {
  quantity: 3,
  card: FIXTURE_CARDS.guards,
  counterparty: FIXTURE_PEOPLE.mira.userName,
};

function Collapsing({ className, children }: { className: string; children: ReactNode }) {
  return (
    <li className={cn("grid", className)}>
      <div className="overflow-hidden">
        <ul className="pb-2">{children}</ul>
      </div>
    </li>
  );
}

export function LoansVignette() {
  return (
    <ClipFrame className="flex flex-col gap-5 p-5">
      <section className="flex flex-col gap-2">
        <SectionHeading>{m.loans_group_lent()}</SectionHeading>
        <ul className="flex flex-col">
          <Collapsing className="motion-safe:animate-loans-out grid-rows-[0fr] opacity-0">
            <LoanRow loan={YASUO} trailing={<MarkReturned pressing />} />
          </Collapsing>
          <LoanRow loan={HIDDEN_BLADE} trailing={<MarkReturned />} />
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5">
          <ChevronRightIcon className="text-muted-foreground size-4 rotate-90" aria-hidden="true" />
          <SectionHeading as="span">
            {m.loans_group_history()}
            <Swap
              was={1}
              now={2}
              className="text-muted-foreground/60 ml-1.5 tabular-nums"
              wasAnimation="motion-safe:animate-loans-out"
              nowAnimation="motion-safe:animate-loans-in"
            />
          </SectionHeading>
        </span>
        <ul className="flex flex-col">
          <Collapsing className="motion-safe:animate-loans-in grid-rows-[1fr]">
            <LoanRow
              loan={YASUO}
              trailing={<Badge variant="secondary">{m.loans_status_returned()}</Badge>}
            />
          </Collapsing>
          <LoanRow
            loan={GUARDS}
            trailing={<Badge variant="secondary">{m.loans_status_returned()}</Badge>}
          />
        </ul>
      </section>
    </ClipFrame>
  );
}
