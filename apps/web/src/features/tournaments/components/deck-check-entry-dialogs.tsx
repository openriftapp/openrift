import { enumLabel } from "@openrift/shared/enum-label";
import type {
  DeckCheckEntryCardResponse,
  DeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import type { Printing } from "@openrift/shared/types/catalog";
import { cardSearchAltNames, legendDisplayName } from "@openrift/shared/utils";
import { WellKnown } from "@openrift/shared/well-known";
import { useMemo, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { PrintingThumbnail } from "@/features/cards/components/printing-option-content";
import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { useCards } from "@/features/cards/hooks/use-cards";
import {
  useAddTournamentDeckCheckCard,
  useFixTournamentDeckCheckCard,
  useUpdateTournamentDeckCheckEntry,
} from "@/features/tournaments/hooks/use-tournament-deck-check";
import { useEnumOrders, useZoneOrder } from "@/hooks/use-enums";
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
  const [allowDeckPublishing, setAllowDeckPublishing] = useState(entry.allowDeckPublishing);
  const [allowNameSharing, setAllowNameSharing] = useState(entry.allowNameSharing);
  const [allowRiotIdSharing, setAllowRiotIdSharing] = useState(entry.allowRiotIdSharing);
  const updateEntry = useUpdateTournamentDeckCheckEntry();

  // Seeds on the open transition, not on `entry`: BaseUI's Dialog only fires
  // onOpenChange for user changes, and the feeding query polls mid-edit.
  const [seededOpen, setSeededOpen] = useState(open);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setPlayerName(entry.playerName);
      setRiotId(entry.riotId ?? "");
      setAllowDeckPublishing(entry.allowDeckPublishing);
      setAllowNameSharing(entry.allowNameSharing);
      setAllowRiotIdSharing(entry.allowRiotIdSharing);
    }
  }

  const handleSave = async () => {
    const name = playerName.trim();
    if (!name) {
      return;
    }
    await updateEntry.mutateAsync({
      tournamentId,
      entryId,
      playerName: name,
      riotId: riotId.trim() || null,
      allowDeckPublishing,
      allowNameSharing,
      allowRiotIdSharing,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.tournaments_deck_check_edit_player_title()}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
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
          <div className="flex flex-col gap-2">
            <Label>{m.tournaments_deck_check_public_sharing()}</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="deck-check-publish"
                checked={allowDeckPublishing}
                onCheckedChange={(checked) => setAllowDeckPublishing(checked === true)}
              />
              <Label htmlFor="deck-check-publish" className="font-normal">
                {m.tournaments_deck_check_publish_deck()}
              </Label>
            </div>
            <div className="ml-6 flex items-center gap-2">
              <Checkbox
                id="deck-check-share-name"
                checked={allowNameSharing}
                disabled={!allowDeckPublishing}
                onCheckedChange={(checked) => setAllowNameSharing(checked === true)}
              />
              <Label
                htmlFor="deck-check-share-name"
                className="font-normal data-[disabled]:opacity-50"
                data-disabled={!allowDeckPublishing || undefined}
              >
                {m.tournaments_deck_check_publish_name()}
              </Label>
            </div>
            <div className="ml-6 flex items-center gap-2">
              <Checkbox
                id="deck-check-share-riot-id"
                checked={allowRiotIdSharing}
                disabled={!allowDeckPublishing}
                onCheckedChange={(checked) => setAllowRiotIdSharing(checked === true)}
              />
              <Label
                htmlFor="deck-check-share-riot-id"
                className="font-normal data-[disabled]:opacity-50"
                data-disabled={!allowDeckPublishing || undefined}
              >
                {m.tournaments_deck_check_publish_riot_id()}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={updateEntry.isPending || !playerName.trim()}>
              {updateEntry.isPending ? m.tournaments_deck_check_saving() : m.common_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CardNameSearchField({
  initialName,
  onNameChange,
}: {
  initialName?: string;
  onNameChange: (name: string) => void;
}) {
  const { printingsByCardId } = useCards();
  const { labels } = useEnumOrders();
  const [query, setQuery] = useState(initialName ?? "");

  const results = useMatchingPrintings(printingsByCardId, query).map((printing) => ({
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

function useMatchingPrintings(
  printingsByCardId: ReadonlyMap<string, Printing[]>,
  query: string,
): Printing[] {
  const searchable = useMemo(
    () =>
      [...printingsByCardId.values()].flatMap((printings) => {
        const printing = printings[0];
        return printing
          ? [
              {
                id: printing.cardId,
                slug: printing.cardId,
                name: legendDisplayName(printing.card),
                // A decklist may spell the card either way; match against both forms.
                altNames: cardSearchAltNames(printing.card, [printing.printedName]),
                printing,
              },
            ]
          : [];
      }),
    [printingsByCardId],
  );

  // Names only: the judge reads a decklist, not a card in hand, so there is no
  // code to type here.
  const matches = useCardSearch(searchable, query, undefined, MAX_NAME_MATCHES, MIN_QUERY_LENGTH);
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
  const parsedCopies = Number(copies);
  const copiesValid =
    !splittable ||
    (Number.isInteger(parsedCopies) && parsedCopies >= 1 && parsedCopies <= card.quantity);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || !copiesValid) {
      return;
    }
    await fixCard.mutateAsync({
      tournamentId,
      entryId,
      cardId: card.id,
      name: trimmed,
      // Only sent when the judge actually moved the card, so a name-only fix
      // leaves the original provider section string untouched.
      section: zoneChanged ? section : undefined,
      copies: splittable ? parsedCopies : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <Select value={section} onValueChange={(value) => setSection(value ?? card.zone)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => zoneLabels[value as never] ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {zoneOrder.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zoneLabels[zone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {parsedCopies >= card.quantity
                  ? m.tournaments_deck_check_moves_all({
                      count: card.quantity,
                      zone: zoneLabels[section as never] ?? section,
                    })
                  : m.tournaments_deck_check_moves_some({
                      moved: copiesValid ? parsedCopies : "?",
                      count: card.quantity,
                      zone: zoneLabels[card.zone],
                    })}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={fixCard.isPending || !name.trim() || !copiesValid}>
              {fixCard.isPending ? m.tournaments_deck_check_saving() : m.common_save()}
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

  const handleAdd = async () => {
    const trimmed = name.trim();
    const parsedQuantity = Number(quantity);
    if (
      !trimmed ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 99
    ) {
      return;
    }
    await addCard.mutateAsync({
      tournamentId,
      entryId,
      name: trimmed,
      quantity: parsedQuantity,
      section,
    });
    setName("");
    setQuantity("1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <Select
                  value={section}
                  onValueChange={(value) => setSection(value ?? WellKnown.deckZone.MAIN)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => zoneLabels[value as never] ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {zoneOrder.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zoneLabels[zone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={addCard.isPending || !name.trim()}>
              {addCard.isPending
                ? m.tournaments_deck_check_adding()
                : m.tournaments_deck_check_add()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
