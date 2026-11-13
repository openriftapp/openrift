import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel } from "@openrift/shared/enum-label";
import type {
  DeckCheckEntryCardResponse,
  DeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import type { Printing } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCardSearchIndex } from "@/features/cards/hooks/use-search-index";
import { SaveError } from "@/features/tournaments/components/save-error";
import type { SharingConsent } from "@/features/tournaments/components/sharing-consent-fields";
import { SharingConsentFields } from "@/features/tournaments/components/sharing-consent-fields";
import {
  useAddTournamentDeckCheckCard,
  useFixTournamentDeckCheckCard,
  useUpdateTournamentDeckCheckEntry,
} from "@/features/tournaments/hooks/use-tournament-deck-check";
import { useEnumOrders, useZoneOrder } from "@/hooks/use-enums";
import { parseIntegerInput } from "@/lib/integer-input";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function EditPlayerDialog({
  tournamentId,
  entryId,
  entry,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  entryId: string;
  entry: DeckCheckEntryDetailResponse["entry"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [playerName, setPlayerName] = useState(entry.playerName);
  const [riotId, setRiotId] = useState(entry.riotId ?? "");
  const [consent, setConsent] = useState<SharingConsent>(() => consentOf(entry));
  const updateEntry = useUpdateTournamentDeckCheckEntry();

  // Seeds on the open transition, not on `entry`: BaseUI's Dialog only fires
  // onOpenChange for user changes, and the feeding query polls mid-edit.
  const [seededOpen, setSeededOpen] = useState(open);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setPlayerName(entry.playerName);
      setRiotId(entry.riotId ?? "");
      setConsent(consentOf(entry));
    }
  }

  const handleSave = async () => {
    const name = playerName.trim();
    if (!name) {
      return;
    }
    const patch = { tournamentId, entryId, playerName: name, riotId: riotId.trim() || null };
    if (await runReportedMutation(() => updateEntry.mutateAsync({ ...patch, ...consent }))) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          updateEntry.reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleSave()}>
          <DialogHeader>
            <DialogTitle>{m.tournaments_deck_check_edit_player_title()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deck-check-player-name">{m.common_name()}</Label>
              <Input
                id="deck-check-player-name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deck-check-riot-id">{m.tournaments_deck_check_riot_id_label()}</Label>
              <Input
                id="deck-check-riot-id"
                value={riotId}
                onChange={(event) => setRiotId(event.target.value)}
                maxLength={120}
                placeholder="Player#EUW"
              />
            </div>
            <SharingConsentFields
              idPrefix="deck-check"
              value={consent}
              labels={{
                publish: m.tournaments_deck_check_publish_deck(),
                name: m.tournaments_deck_check_publish_name(),
                riotId: m.tournaments_deck_check_publish_riot_id(),
              }}
              onChange={(patch) => setConsent((current) => ({ ...current, ...patch }))}
            />
          </div>
          <SaveError error={updateEntry.error} />
          <DialogFooter>
            <DialogCancel />
            <Button type="submit" disabled={!playerName.trim()} pending={updateEntry.isPending}>
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function consentOf(entry: DeckCheckEntryDetailResponse["entry"]): SharingConsent {
  return {
    allowDeckPublishing: entry.allowDeckPublishing,
    allowNameSharing: entry.allowNameSharing,
    allowRiotIdSharing: entry.allowRiotIdSharing,
  };
}

function CardNameSearchField({
  initialName,
  onNameChange,
}: {
  initialName?: string;
  onNameChange: (name: string) => void;
}) {
  const { allPrintings } = useCards();
  const { labels } = useEnumOrders();
  const [query, setQuery] = useState(initialName ?? "");

  const results = useMatchingPrintings(allPrintings, query).map((printing) => ({
    id: printing.cardId,
    label: legendDisplayName(printing.card),
    sublabel: printing.card.types.map((slug) => enumLabel(labels.cardTypes, slug)).join(" "),
    leading: <PrintingThumbnail printing={printing} className="h-8" />,
  }));

  return (
    <CardSearchDropdown
      ariaLabel={m.tournaments_deck_check_card_name_aria()}
      placeholder={m.tournaments_deck_check_card_name_placeholder()}
      initialQuery={initialName}
      className="w-full"
      results={results}
      onSearch={setQuery}
      onSelect={(_id, result) => onNameChange(result.label)}
      onRawInputChange={onNameChange}
    />
  );
}

const MAX_NAME_MATCHES = 8;
const MIN_QUERY_LENGTH = 1;

function useMatchingPrintings(allPrintings: readonly Printing[], query: string): Printing[] {
  const index = useCardSearchIndex(allPrintings);
  const matches = useCardSearch(index, query, MAX_NAME_MATCHES, MIN_QUERY_LENGTH);
  return matches.map((row) => row.printing);
}

export function FixCardDialog({
  tournamentId,
  entryId,
  card,
  open,
  onOpenChange,
  zoneOnly = false,
}: {
  tournamentId: string;
  entryId: string;
  card: DeckCheckEntryCardResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Restricts the dialog to moving zones, keeping the card's catalog identity
   * fixed. Used once a list is approved or checked.
   */
  zoneOnly?: boolean;
}) {
  const { zoneOrder, zoneLabels } = useZoneOrder();
  const [name, setName] = useState(card.rawName);
  const [section, setSection] = useState<string>(card.zone);
  const [copies, setCopies] = useState(String(card.quantity));
  const fixCard = useFixTournamentDeckCheckCard();

  // This dialog is reused per row: fields reset only when `open` transitions to true.
  const [seededOpen, setSeededOpen] = useState(open);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setName(card.rawName);
      setSection(card.zone);
      setCopies(String(card.quantity));
    }
  }

  const zoneChanged = section !== card.zone;
  const splittable = zoneChanged && card.quantity > 1;
  const parsedCopies = parseIntegerInput(copies, 1, card.quantity) ?? undefined;
  const copiesValid = !splittable || parsedCopies !== undefined;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || !copiesValid) {
      return;
    }
    const fix = {
      tournamentId,
      entryId,
      cardId: card.id,
      name: trimmed,
      // Only sent when the judge actually moved the card, so a name-only fix
      // leaves the original provider section string untouched.
      section: zoneChanged ? section : undefined,
      copies: splittable ? parsedCopies : undefined,
    };
    if (await runReportedMutation(() => fixCard.mutateAsync(fix))) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          fixCard.reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleSave()}>
          <DialogHeader>
            <DialogTitle>
              {zoneOnly
                ? m.tournaments_deck_check_move_card_title()
                : m.tournaments_deck_check_fix_card_title()}
            </DialogTitle>
            <DialogDescription>
              {zoneOnly
                ? m.tournaments_deck_check_move_card_description()
                : m.tournaments_deck_check_fix_card_description()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {zoneOnly ? (
              <div className="flex flex-col gap-1.5">
                <Label>{m.tournaments_deck_check_card_name_label()}</Label>
                <p className="text-muted-foreground text-sm">{card.rawName}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>{m.tournaments_deck_check_card_name_label()}</Label>
                <CardNameSearchField
                  key={String(open)}
                  initialName={card.rawName}
                  onNameChange={setName}
                />
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>{m.tournaments_deck_check_zone_label()}</Label>
                <SimpleSelect
                  items={zoneOrder.map((zone) => ({
                    value: zone,
                    label: enumLabel(zoneLabels, zone),
                  }))}
                  value={section}
                  onChange={setSection}
                  className="w-full"
                />
              </div>
              {splittable ? (
                <div className="flex w-28 flex-col gap-1.5">
                  <Label htmlFor="deck-check-fix-copies">
                    {m.tournaments_deck_check_copies_to_move()}
                  </Label>
                  <Input
                    id="deck-check-fix-copies"
                    inputMode="numeric"
                    value={copies}
                    onChange={(event) => setCopies(event.target.value.replaceAll(/[^0-9]/gu, ""))}
                  />
                </div>
              ) : null}
            </div>
            {splittable ? (
              <p className="text-muted-foreground text-sm">
                {parsedCopies === card.quantity
                  ? m.tournaments_deck_check_moves_all({
                      count: card.quantity,
                      zone: enumLabel(zoneLabels, section),
                    })
                  : m.tournaments_deck_check_moves_some({
                      moved: parsedCopies ?? "?",
                      count: card.quantity,
                      zone: enumLabel(zoneLabels, card.zone),
                    })}
              </p>
            ) : null}
          </div>
          <SaveError error={fixCard.error} />
          <DialogFooter>
            <DialogCancel />
            <Button
              type="submit"
              disabled={!name.trim() || !copiesValid}
              pending={fixCard.isPending}
            >
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function AddCardDialog({
  tournamentId,
  entryId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { zoneOrder, zoneLabels } = useZoneOrder();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [section, setSection] = useState<string>(WellKnown.deckZone.MAIN);
  const addCard = useAddTournamentDeckCheckCard();
  const parsedQuantity = parseIntegerInput(quantity, 1, 99) ?? undefined;

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || parsedQuantity === undefined) {
      return;
    }
    const card = { tournamentId, entryId, name: trimmed, quantity: parsedQuantity, section };
    if (await runReportedMutation(() => addCard.mutateAsync(card))) {
      setName("");
      setQuantity("1");
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          addCard.reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleAdd()}>
          <DialogHeader>
            <DialogTitle>{m.tournaments_deck_check_add_card_title()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_deck_check_card_name_label()}</Label>
              <CardNameSearchField key={String(open)} onNameChange={setName} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="deck-check-card-quantity">
                  {m.tournaments_deck_check_copies_label()}
                </Label>
                <Input
                  id="deck-check-card-quantity"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value.replaceAll(/[^0-9]/gu, ""))}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>{m.tournaments_deck_check_zone_label()}</Label>
                <SimpleSelect
                  items={zoneOrder.map((zone) => ({
                    value: zone,
                    label: enumLabel(zoneLabels, zone),
                  }))}
                  value={section}
                  onChange={setSection}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          <SaveError error={addCard.error} />
          <DialogFooter>
            <DialogCancel />
            <Button
              type="submit"
              disabled={!name.trim() || parsedQuantity === undefined}
              pending={addCard.isPending}
            >
              {m.tournaments_deck_check_add()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
