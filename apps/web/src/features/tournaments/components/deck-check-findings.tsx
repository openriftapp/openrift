import type {
  DeckCheckChangeSummary,
  DeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { legendDisplayName } from "@openrift/shared/utils";
import { RefreshCwIcon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Label } from "@/components/ui/label";
import { useCards } from "@/features/cards/hooks/use-cards";
import {
  useApplyTournamentDeckCheckZoneFixes,
  useReResolveTournamentDeckCheck,
} from "@/features/tournaments/hooks/use-tournament-deck-check";
import { zoneFixAllowed } from "@/features/tournaments/lib/deck-check-actions";
import { useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export function ChangeBanner({ summary }: { summary: DeckCheckChangeSummary }) {
  const describe = (line: { name: string; quantity: number }) => `${line.quantity}× ${line.name}`;
  return (
    <div className="border-destructive/40 bg-destructive-soft flex flex-col gap-1 rounded-md border p-3 text-sm">
      <span className="font-medium">{m.tournaments_deck_check_change_banner_title()}</span>
      {summary.added.length > 0 ? (
        <span>
          {m.tournaments_deck_check_change_added({
            lines: summary.added.map((line) => describe(line)).join(", "),
          })}
        </span>
      ) : null}
      {summary.removed.length > 0 ? (
        <span>
          {m.tournaments_deck_check_change_removed({
            lines: summary.removed.map((line) => describe(line)).join(", "),
          })}
        </span>
      ) : null}
      {summary.changed.length > 0 ? (
        <span>
          {m.tournaments_deck_check_change_changed({
            lines: summary.changed
              .map((line) => `${line.name} ${line.oldQuantity}× → ${line.newQuantity}×`)
              .join(", "),
          })}
        </span>
      ) : null}
    </div>
  );
}

function reResolveMessage(updatedLines: number): string {
  return m.tournaments_deck_check_resolved_lines({ count: updatedLines });
}

export function FindingsBanner({
  tournamentId,
  detail,
  onResolved,
}: {
  tournamentId: string;
  detail: DeckCheckEntryDetailResponse;
  onResolved: () => void;
}) {
  const reResolve = useReResolveTournamentDeckCheck();
  const [fixZonesOpen, setFixZonesOpen] = useState(false);
  const unmatched = detail.cards.filter((card) => card.matchStatus !== "matched");
  const suggestions = detail.zoneSuggestions;
  // Zone corrections are allowed while submitted, approved, or checked, the same gate the per-card pencil uses. Add/remove stays locked to submitted.
  const canFixZones = suggestions.length > 0 && zoneFixAllowed(detail.entry.state);
  if (detail.violations.length === 0 && unmatched.length === 0 && suggestions.length === 0) {
    return null;
  }

  async function handleReResolve() {
    try {
      const result = await reResolve.mutateAsync({ tournamentId });
      if (result.updatedLines === 0) {
        toast.info(m.tournaments_deck_check_no_new_matches());
      } else {
        toast.info(reResolveMessage(result.updatedLines));
      }
      onResolved();
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className="border-warning/40 bg-warning-soft flex flex-col gap-2 rounded-md border p-3 text-sm">
      <span className="font-medium">{m.tournaments_deck_check_findings_title()}</span>
      <ul className="list-disc pl-5">
        {unmatched.length > 0 ? (
          <li>{m.tournaments_deck_check_unmatched_finding({ count: unmatched.length })}</li>
        ) : null}
        {suggestions.length > 0 ? (
          <li>{m.tournaments_deck_check_mis_zoned_finding({ count: suggestions.length })}</li>
        ) : null}
        {detail.violations.map((violation) => (
          <li key={`${violation.zone}:${violation.code}:${violation.cardId ?? ""}`}>
            {violation.message}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {unmatched.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={reResolve.isPending}
            title={m.tournaments_deck_check_re_resolve_title()}
            onClick={() => void handleReResolve()}
          >
            <RefreshCwIcon className="size-4" />
            {m.tournaments_deck_check_re_resolve()}
          </Button>
        ) : null}
        {canFixZones ? (
          <Button size="sm" variant="outline" onClick={() => setFixZonesOpen(true)}>
            <WandSparklesIcon className="size-4" />
            {m.tournaments_deck_check_fix_zones()}
          </Button>
        ) : null}
      </div>
      {canFixZones ? (
        <FixZonesDialog
          tournamentId={tournamentId}
          entryId={detail.entry.id}
          suggestions={suggestions}
          open={fixZonesOpen}
          onOpenChange={setFixZonesOpen}
        />
      ) : null}
    </div>
  );
}

function FixZonesDialog({
  tournamentId,
  entryId,
  suggestions,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  entryId: string;
  suggestions: DeckCheckEntryDetailResponse["zoneSuggestions"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { zoneLabels } = useZoneOrder();
  const { printingsByCardId } = useCards();
  const applyZoneFixes = useApplyTournamentDeckCheckZoneFixes();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.map((suggestion) => suggestion.cardId)),
  );

  const displayNameFor = (suggestion: DeckCheckEntryDetailResponse["zoneSuggestions"][number]) => {
    const printing = printingsByCardId.get(suggestion.cardId)?.[0];
    return printing ? legendDisplayName(printing.card) : suggestion.cardName;
  };

  const handleApply = async () => {
    const cardIds = suggestions
      .map((suggestion) => suggestion.cardId)
      .filter((cardId) => selected.has(cardId));
    if (cardIds.length === 0) {
      return;
    }
    await applyZoneFixes.mutateAsync({ tournamentId, entryId, cardIds });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setSelected(new Set(suggestions.map((suggestion) => suggestion.cardId)));
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleApply()}>
          <DialogHeader>
            <DialogTitle>{m.tournaments_deck_check_fix_zones_title()}</DialogTitle>
            <DialogDescription>
              {m.tournaments_deck_check_fix_zones_description()}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.cardId}>
                <Label className="hover:bg-muted/50 flex items-center gap-3 rounded-md p-2">
                  <Checkbox
                    checked={selected.has(suggestion.cardId)}
                    onCheckedChange={(checked: boolean) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          next.add(suggestion.cardId);
                        } else {
                          next.delete(suggestion.cardId);
                        }
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate font-normal">
                    {displayNameFor(suggestion)}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    {zoneLabels[suggestion.currentZone]} → {zoneLabels[suggestion.suggestedZone]}
                  </span>
                </Label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={applyZoneFixes.isPending || selected.size === 0}>
              {applyZoneFixes.isPending
                ? m.tournaments_deck_check_applying()
                : m.tournaments_deck_check_move_count({ count: selected.size })}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
