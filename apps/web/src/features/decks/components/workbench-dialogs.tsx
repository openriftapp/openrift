import { legendDisplayName } from "@openrift/shared/card-name";
import { battlefieldCapFor } from "@openrift/shared/deck-rules";
import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCustomTagAssignments } from "@/features/collections/hooks/use-custom-tag-assignments";
import { useDeckBuilderActions, useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { catalogCardToDeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { previewLegendSwitch } from "@/features/decks/lib/legend-switch-preview";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useChampionIdentifierTags, useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function nameOf(card: DeckBuilderCard): string {
  return legendDisplayName({ name: card.cardName, types: card.cardTypes, tags: card.tags });
}

function SwitchLine({
  sign,
  tone,
  children,
}: {
  sign: string;
  tone: "warning" | "success";
  children: ReactNode;
}) {
  return (
    <li className="flex gap-2">
      <span
        aria-hidden
        className={cn(
          "w-5 shrink-0 text-center font-semibold",
          tone === "warning" ? "text-warning" : "text-success",
        )}
      >
        {sign}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function LegendSwitchDialog({ deckId, legend }: { deckId: string; legend: DeckBuilderCard }) {
  const cards = useDeckCards(deckId);
  const { data } = useDeckDetail(deckId);
  const customTagAssignments = useCustomTagAssignments();
  const championIdentifierTags = useChampionIdentifierTags();
  const { labels } = useEnumOrders();
  const runesByDomain = useDeckBuilderUiStore((state) => state.runesByDomain);
  const setPendingLegend = useWorkbenchStore((state) => state.setPendingLegend);
  const { setLegend } = useDeckBuilderActions(deckId);
  const [moveOffColor, setMoveOffColor] = useState(false);

  const current = cards.find((card) => card.zone === WellKnown.deckZone.LEGEND);
  const preview = previewLegendSwitch(cards, legend, runesByDomain, {
    format: data.deck.format,
    formatConfig: data.deck.formatConfig,
    championIdentifierTags,
    customTagAssignments,
  });
  const domainsText = (domains: string[]) =>
    domains.map((domain) => enumLabel(labels.domains, domain)).join(" ");

  const close = () => setPendingLegend(null);
  const confirm = () => {
    setLegend(legend, undefined, { confirmed: true, moveOffColorToOverflow: moveOffColor });
    close();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.decks_workbench_switch_legend_title()}</DialogTitle>
          <DialogDescription>
            {m.decks_workbench_switch_legend_from_to({
              from: current ? nameOf(current) : "",
              to: nameOf(legend),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <span className="text-muted-foreground">{m.decks_workbench_switch_domains()}</span>
          <span>
            {m.decks_workbench_switch_domains_change({
              from: domainsText(current?.domains ?? []),
              to: domainsText(legend.domains),
            })}
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {preview.runesRemoved.map((rune) => (
            <SwitchLine key={`out-${rune.name}`} sign="−" tone="warning">
              {m.decks_workbench_switch_rune_out({ count: rune.quantity, rune: rune.name })}
            </SwitchLine>
          ))}
          {preview.runesAdded.map((rune) => (
            <SwitchLine key={`in-${rune.name}`} sign="+" tone="success">
              {m.decks_workbench_switch_rune_in({ count: rune.quantity, rune: rune.name })}
            </SwitchLine>
          ))}
          {(preview.runesRemoved.length > 0 || preview.runesAdded.length > 0) && (
            <li className="text-muted-foreground pl-7">
              {m.decks_workbench_switch_rune_total({ count: preview.runeTotalAfter })}
            </li>
          )}
          {preview.offColorCount > 0 && (
            <SwitchLine sign="!" tone="warning">
              {m.decks_workbench_switch_off_color({ count: preview.offColorCount })}
            </SwitchLine>
          )}
          {preview.champion &&
            (preview.championLegal ? (
              <SwitchLine sign="✓" tone="success">
                {m.decks_workbench_switch_champion_legal({ champion: nameOf(preview.champion) })}
              </SwitchLine>
            ) : (
              <SwitchLine sign="!" tone="warning">
                {m.decks_workbench_switch_champion_mismatch()}
              </SwitchLine>
            ))}
          {preview.newViolations.length > 0 && (
            <SwitchLine sign="!" tone="warning">
              {m.decks_workbench_switch_new_warnings({ count: preview.newViolations.length })}
              <ul className="text-muted-foreground">
                {preview.newViolations.map((violation) => (
                  <li key={`${violation.code}-${violation.zone}-${violation.cardId ?? ""}`}>
                    {violation.message}
                  </li>
                ))}
              </ul>
            </SwitchLine>
          )}
          {preview.resolvedViolations.length > 0 && (
            <SwitchLine sign="✓" tone="success">
              {m.decks_workbench_switch_resolved_warnings({
                count: preview.resolvedViolations.length,
              })}
              <ul className="text-muted-foreground">
                {preview.resolvedViolations.map((violation) => (
                  <li key={`${violation.code}-${violation.zone}-${violation.cardId ?? ""}`}>
                    {violation.message}
                  </li>
                ))}
              </ul>
            </SwitchLine>
          )}
        </ul>
        {preview.offColorCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="workbench-move-off-color"
              checked={moveOffColor}
              onCheckedChange={(checked) => setMoveOffColor(checked === true)}
            />
            <Label htmlFor="workbench-move-off-color">
              {m.decks_workbench_switch_move_off_color({ count: preview.offColorCount })}
            </Label>
          </div>
        )}
        <DialogFooter>
          <DialogCancel />
          <Button onClick={confirm}>{m.decks_workbench_switch_legend_confirm()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BattlefieldReplaceDialog({
  deckId,
  target,
}: {
  deckId: string;
  target: { cardId: string; preferredPrintingId: string | null };
}) {
  const cards = useDeckCards(deckId);
  const { data } = useDeckDetail(deckId);
  const { cardsById } = useCards();
  const setReplaceTarget = useWorkbenchStore((state) => state.setReplaceTarget);
  const { addCard, replaceCard } = useDeckBuilderActions(deckId);

  const catalogCard = cardsById[target.cardId];
  const battlefields = cards.filter((card) => card.zone === WellKnown.deckZone.BATTLEFIELD);
  const cap = battlefieldCapFor(data.deck.format);
  const close = () => setReplaceTarget(null);
  if (!catalogCard) {
    return null;
  }
  const incoming: DeckBuilderCard = {
    ...catalogCardToDeckBuilderCard(target.cardId, catalogCard),
    preferredPrintingId: target.preferredPrintingId,
  };

  const replace = (outgoing: DeckBuilderCard) => {
    replaceCard(outgoing, incoming, WellKnown.deckZone.BATTLEFIELD);
    close();
  };
  const addAnyway = () => {
    addCard(incoming, WellKnown.deckZone.BATTLEFIELD);
    close();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.decks_workbench_battlefields_full_title({ count: cap })}</DialogTitle>
          <DialogDescription>
            {m.decks_workbench_battlefields_full_description({ card: nameOf(incoming) })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {battlefields.map((outgoing) => (
            <Button
              key={`${outgoing.cardId}-${outgoing.preferredPrintingId ?? "default"}`}
              variant="outline"
              className="justify-start"
              onClick={() => replace(outgoing)}
            >
              {m.decks_workbench_replace_card({ card: nameOf(outgoing) })}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <DialogCancel />
          <Button variant="ghost" className="text-warning" onClick={addAnyway}>
            {m.decks_workbench_add_anyway({ count: battlefields.length + 1 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkbenchDialogs({ deckId }: { deckId: string }) {
  const pendingLegend = useWorkbenchStore((state) => state.pendingLegend);
  const replaceTarget = useWorkbenchStore((state) => state.replaceTarget);
  return (
    <>
      {pendingLegend && (
        <LegendSwitchDialog key={pendingLegend.cardId} deckId={deckId} legend={pendingLegend} />
      )}
      {replaceTarget && (
        <BattlefieldReplaceDialog
          key={replaceTarget.cardId}
          deckId={deckId}
          target={replaceTarget}
        />
      )}
    </>
  );
}
