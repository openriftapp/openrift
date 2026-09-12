import { imageUrl } from "@openrift/shared/image-url";
import type {
  DeckMatchupSwapResponse,
  DeckPlanCardMetaResponse,
  DeckPlanResponse,
} from "@openrift/shared/types/api/deck";
import { getOrientation } from "@openrift/shared/utils";

import { Heading } from "@/components/heading";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { SectionHeading } from "@/components/ui/section-heading";
import { MatchupCard } from "@/features/decks/components/deck-matchup-card";
import { m } from "@/paraglide/messages.js";

type CardMetaLookup = (cardId: string) => DeckPlanCardMetaResponse | undefined;

function CardLine({
  cardId,
  lookup,
  quantity,
}: {
  cardId: string;
  lookup: CardMetaLookup;
  quantity?: number;
}) {
  const meta = lookup(cardId);
  const landscape = getOrientation(meta?.cardTypes ?? []) === "landscape";
  return (
    <span className="inline-flex items-center gap-2">
      {meta?.imageId ? (
        <ImgWithFallback
          src={imageUrl(meta.imageId, "400w")}
          alt=""
          className={
            landscape ? "h-6 w-9 rounded-xs object-cover" : "h-8 w-6 rounded-xs object-cover"
          }
          fallback={null}
        />
      ) : null}
      <span className="truncate">
        {quantity === undefined ? null : (
          <span className="text-muted-foreground">{quantity}× </span>
        )}
        {meta?.cardName ?? m.decks_plan_unknown_card()}
      </span>
    </span>
  );
}

function SwapColumn({
  label,
  tone,
  sign,
  swaps,
  lookup,
}: {
  label: string;
  tone: string;
  sign: string;
  swaps: DeckMatchupSwapResponse[];
  lookup: CardMetaLookup;
}) {
  return (
    <div className="flex-1 space-y-1.5">
      <SectionHeading size="sm" className={tone}>
        {sign} {label}
      </SectionHeading>
      {swaps.length === 0 ? (
        <div className="text-muted-foreground text-sm">{m.decks_plan_no_changes()}</div>
      ) : (
        swaps.map((swap) => (
          <div key={swap.cardId}>
            <CardLine cardId={swap.cardId} lookup={lookup} quantity={swap.quantity} />
          </div>
        ))
      )}
    </div>
  );
}

export function DeckPlanView({
  plan,
  planCardMeta,
  hideHeading,
}: {
  plan: DeckPlanResponse;
  planCardMeta: DeckPlanCardMetaResponse[];
  hideHeading?: boolean;
}) {
  const metaById = new Map(planCardMeta.map((meta) => [meta.cardId, meta]));
  const lookup: CardMetaLookup = (cardId) => metaById.get(cardId);

  const battlefields = [
    { label: m.decks_plan_game_1(), cardId: plan.battlefieldGame1CardId },
    { label: m.decks_plan_going_first(), cardId: plan.battlefieldFirstCardId },
    { label: m.decks_plan_going_second(), cardId: plan.battlefieldSecondCardId },
  ].flatMap((entry) =>
    entry.cardId === null ? [] : [{ label: entry.label, cardId: entry.cardId }],
  );

  const hasMulligan = plan.mulliganSplit
    ? plan.mulliganFirst !== "" || plan.mulliganSecond !== ""
    : plan.mulliganGeneral !== "";

  const hasBattlefields = plan.battlefieldCustom
    ? plan.battlefieldNote !== ""
    : battlefields.length > 0;

  return (
    <section className="space-y-6">
      {!hideHeading && <Heading>{m.decks_plan_heading()}</Heading>}

      {plan.generalStrategy !== "" && (
        <div className="space-y-2">
          <Heading level={3}>{m.decks_plan_strategy()}</Heading>
          <p className="text-muted-foreground max-w-prose whitespace-pre-wrap">
            {plan.generalStrategy}
          </p>
        </div>
      )}

      {hasMulligan ? (
        <div className="space-y-2">
          <Heading level={3}>{m.decks_plan_mulligan_priority()}</Heading>
          {plan.mulliganSplit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground text-xs">{m.decks_plan_going_first()}</div>
                <p className="whitespace-pre-wrap">{plan.mulliganFirst || "—"}</p>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{m.decks_plan_going_second()}</div>
                <p className="whitespace-pre-wrap">{plan.mulliganSecond || "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground max-w-prose whitespace-pre-wrap">
              {plan.mulliganGeneral}
            </p>
          )}
        </div>
      ) : null}

      {hasBattlefields ? (
        <div className="space-y-2">
          <Heading level={3}>{m.decks_plan_battlefields()}</Heading>
          {plan.battlefieldCustom ? (
            <p className="text-muted-foreground max-w-prose whitespace-pre-wrap">
              {plan.battlefieldNote}
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {battlefields.map((entry) => (
                <div key={entry.label} className="space-y-0.5">
                  <div className="text-muted-foreground text-xs">{entry.label}</div>
                  <CardLine cardId={entry.cardId} lookup={lookup} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {plan.matchups.length > 0 ? (
        <div className="space-y-2">
          <Heading level={3}>{m.decks_plan_matchups()}</Heading>
          <div className="grid gap-4 @2xl:grid-cols-2">
            {plan.matchups.map((matchup) => {
              const outSwaps = matchup.swaps.filter((swap) => swap.direction === "out");
              const inSwaps = matchup.swaps.filter((swap) => swap.direction === "in");
              return (
                <MatchupCard
                  key={matchup.id}
                  header={
                    matchup.opponentCardId === null ? (
                      <span className="truncate font-medium">{matchup.opponentLabel}</span>
                    ) : (
                      <>
                        <CardLine cardId={matchup.opponentCardId} lookup={lookup} />
                        {matchup.opponentLabel !== "" && (
                          <span className="text-muted-foreground truncate">
                            {matchup.opponentLabel}
                          </span>
                        )}
                      </>
                    )
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <SwapColumn
                      label={m.decks_plan_swap_out()}
                      tone="text-destructive"
                      sign="−"
                      swaps={outSwaps}
                      lookup={lookup}
                    />
                    <SwapColumn
                      label={m.decks_plan_swap_in()}
                      tone="text-success"
                      sign="+"
                      swaps={inSwaps}
                      lookup={lookup}
                    />
                  </div>
                  {matchup.notes !== "" && (
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {matchup.notes}
                    </p>
                  )}
                </MatchupCard>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
