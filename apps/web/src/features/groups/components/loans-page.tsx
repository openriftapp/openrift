import { enumLabel } from "@openrift/shared/enum-label";
import type { LoanResponse } from "@openrift/shared/types/api/loan";
import { getOrientation } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, EllipsisVerticalIcon, HandHeartIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardRow } from "@/components/ui/card-list";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { ReturnLoanDialog } from "@/features/groups/components/return-loan-dialog";
import { CardMetaLine } from "@/features/groups/components/trade-row-parts";
import { WriteOffLoanDialog } from "@/features/groups/components/write-off-loan-dialog";
import {
  useAcknowledgeLoan,
  useDeleteLoan,
  useLoans,
  useRejectLoan,
  useReturnLoanCopies,
  useWriteOffLoan,
} from "@/features/groups/hooks/use-loans";
import {
  loanCounterpartyLabel,
  loanSection,
  loanStatusLabel,
  outstandingQuantity,
} from "@/features/groups/lib/loan-derivation";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function LoanRow({ loan }: { loan: LoanResponse }) {
  const { cardsById, printingsById } = useCards();
  const { labels } = useEnumOrders();

  const acknowledge = useAcknowledgeLoan();
  const reject = useRejectLoan();
  const returnCopies = useReturnLoanCopies();
  const writeOff = useWriteOffLoan();
  const deleteLoan = useDeleteLoan();

  const [returnOpen, setReturnOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  const card = cardsById[loan.cardId];
  const printing = printingsById[loan.printingId];
  const cardName = card?.name ?? m.loans_card_fallback();
  const imageId = frontImageId(printing);

  const lending = loan.role === "lender";
  const outstanding = outstandingQuantity(loan);
  const acting =
    acknowledge.isPending ||
    reject.isPending ||
    returnCopies.isPending ||
    writeOff.isPending ||
    deleteLoan.isPending;

  const counterpartyName = loanCounterpartyLabel(loan);
  const quantityLabel =
    loan.status === "active" && loan.returnedQuantity > 0
      ? m.loans_quantity_partial({ outstanding, total: loan.quantity, card: cardName })
      : m.loans_quantity({ count: loan.quantity, card: cardName });

  return (
    <CardRow className="flex-col items-stretch justify-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:contents">
        <CardArtThumb
          shape="strip"
          imageId={imageId}
          alt={cardName}
          landscape={card ? getOrientation(card.types) === "landscape" : false}
          rarity={printing?.rarity}
          domains={card?.domains}
          className="h-10"
          loading="lazy"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{quantityLabel}</span>
          {printing ? (
            <CardMetaLine
              shortCode={printing.shortCode}
              rarity={printing.rarity}
              rarityLabel={enumLabel(labels.rarities, printing.rarity)}
              finish={printing.finish}
              finishLabel={enumLabel(labels.finishes, printing.finish)}
            />
          ) : null}
        </div>

        <span className="flex shrink-0 items-center gap-1.5 px-1.5 py-1" title={counterpartyName}>
          {loan.counterparty ? (
            <UserAvatar
              image={loan.counterparty.image}
              name={loan.counterparty.name}
              gravatarHash={loan.counterparty.gravatarHash}
              size="sm"
            />
          ) : null}
          <span className="text-sm">
            {lending
              ? m.loans_to_person({ name: counterpartyName })
              : m.loans_from_person({ name: counterpartyName })}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2 sm:contents">
        <LoanStatusBadge loan={loan} />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
          {loan.actionNeeded === "acknowledge" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={acting}
                onClick={() => reject.mutate({ loanId: loan.id })}
              >
                {m.loans_dont_have_this()}
              </Button>
              <Button
                size="sm"
                disabled={acting}
                onClick={() => acknowledge.mutate({ loanId: loan.id })}
              >
                {m.loans_got_it()}
              </Button>
            </>
          ) : null}

          {lending && loan.status === "active" ? (
            <Button
              size="sm"
              disabled={acting}
              onClick={() =>
                outstanding === 1
                  ? returnCopies.mutate({ loanId: loan.id, quantity: 1 })
                  : setReturnOpen(true)
              }
            >
              {m.loans_mark_returned()}
            </Button>
          ) : null}

          {lending ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={m.loans_more_actions()} />
                }
              >
                <EllipsisVerticalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {loan.status === "active" ? (
                  <DropdownMenuItem onClick={() => setWriteOffOpen(true)}>
                    {m.loans_not_coming_back()}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    deleteLoan.mutate(
                      { loanId: loan.id },
                      { onSuccess: () => toast.success(m.loans_deleted_toast()) },
                    )
                  }
                >
                  {m.common_delete()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {returnOpen ? (
        <ReturnLoanDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          outstanding={outstanding}
          pending={returnCopies.isPending}
          onConfirm={(quantity) =>
            returnCopies.mutate(
              { loanId: loan.id, quantity },
              { onSuccess: () => setReturnOpen(false) },
            )
          }
        />
      ) : null}

      {writeOffOpen ? (
        <WriteOffLoanDialog
          open={writeOffOpen}
          onOpenChange={setWriteOffOpen}
          cardName={cardName}
          outstanding={outstanding}
          pending={writeOff.isPending}
          onConfirm={(removeCopies) =>
            writeOff.mutate(
              { loanId: loan.id, removeCopies },
              { onSuccess: () => setWriteOffOpen(false) },
            )
          }
        />
      ) : null}
    </CardRow>
  );
}

function LoanStatusBadge({ loan }: { loan: LoanResponse }) {
  if (loan.status !== "active") {
    return (
      <Badge variant="secondary" className="shrink-0">
        {loanStatusLabel(loan.status)}
      </Badge>
    );
  }
  if (loan.role === "lender" && loan.rejectedAt !== null) {
    return (
      <Badge variant="warning" className="shrink-0" title={m.loans_rejected_badge_title()}>
        {m.loans_rejected_badge()}
      </Badge>
    );
  }
  if (loan.role === "lender" && loan.counterparty !== null && loan.acknowledgedAt === null) {
    return (
      <Badge variant="secondary" className="shrink-0">
        {m.loans_unconfirmed()}
      </Badge>
    );
  }
  if (loan.role === "borrower" && loan.actionNeeded === "acknowledge") {
    return (
      <Badge variant="warning" className="shrink-0">
        {m.loans_new()}
      </Badge>
    );
  }
  return null;
}

function LoanGroup({ heading, loans }: { heading: string; loans: LoanResponse[] }) {
  if (loans.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{heading}</SectionHeading>
      <ul className="flex flex-col gap-2">
        {loans.map((loan) => (
          <LoanRow key={loan.id} loan={loan} />
        ))}
      </ul>
    </section>
  );
}

export function LoansPage() {
  const { data } = useLoans();

  const loans = data?.items ?? [];
  const attention: LoanResponse[] = [];
  const lent: LoanResponse[] = [];
  const borrowed: LoanResponse[] = [];
  const history: LoanResponse[] = [];
  for (const loan of loans) {
    const section = loanSection(loan);
    if (section === "attention") {
      attention.push(loan);
    } else if (section === "lent") {
      lent.push(loan);
    } else if (section === "borrowed") {
      borrowed.push(loan);
    } else if (section === "history") {
      history.push(loan);
    }
  }
  lent.sort((a, b) => loanCounterpartyLabel(a).localeCompare(loanCounterpartyLabel(b)));

  const empty = data !== undefined && loans.length === 0;

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.loans_page_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-6 pt-3 pb-12")}>
        <PageDescription>{m.loans_page_description()}</PageDescription>

        {empty ? (
          <EmptyState
            className="py-12"
            icon={HandHeartIcon}
            title={m.loans_empty_title()}
            description={m.loans_empty_description()}
          >
            <Link to="/collections" className={buttonVariants({ variant: "default" })}>
              {m.loans_empty_cta()}
            </Link>
          </EmptyState>
        ) : null}

        <LoanGroup heading={m.loans_group_attention()} loans={attention} />
        <LoanGroup heading={m.loans_group_lent()} loans={lent} />
        <LoanGroup heading={m.loans_group_borrowed()} loans={borrowed} />

        {history.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5">
              <ChevronRightIcon className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" />
              <SectionHeading as="span" count={history.length}>
                {m.loans_group_history()}
              </SectionHeading>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ul className="flex flex-col gap-2">
                {history.map((loan) => (
                  <LoanRow key={loan.id} loan={loan} />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </>
  );
}
