import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { DeckCheckSubmissionResultResponse } from "@openrift/shared/types/api/deck-check";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import { useDecks } from "@/features/decks/hooks/use-decks";
import { parseManualDecklist } from "@/features/tournaments/lib/deck-check-manual-entry";
import { m } from "@/paraglide/messages.js";

export interface DeckSourceInput {
  deckId?: string;
  deckCode?: string;
  cards?: { name: string; quantity: number; section: string }[];
  allowDeckPublishing: boolean;
  allowNameSharing: boolean;
  allowRiotIdSharing: boolean;
}

const NO_DECK = "__none__";

type DeckSource = Omit<
  DeckSourceInput,
  "allowDeckPublishing" | "allowNameSharing" | "allowRiotIdSharing"
>;

function pasteToInput(paste: string): DeckSource | null {
  const trimmed = paste.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!/\s/u.test(trimmed)) {
    return { deckCode: trimmed };
  }
  const parsed = parseManualDecklist(trimmed);
  return parsed.cards.length > 0 ? { cards: parsed.cards } : null;
}

export function PlayerDeckSourceForm({
  submitLabel,
  pendingLabel,
  isSubmitting,
  onSubmit,
  onPreview,
  preview,
  isPreviewing,
  initialAllowDeckPublishing = true,
  initialAllowNameSharing = true,
  initialAllowRiotIdSharing = true,
}: {
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
  onSubmit: (input: DeckSourceInput) => void;
  onPreview: (input: DeckSourceInput) => void;
  preview: DeckCheckSubmissionResultResponse | null;
  isPreviewing: boolean;
  initialAllowDeckPublishing?: boolean;
  initialAllowNameSharing?: boolean;
  initialAllowRiotIdSharing?: boolean;
}) {
  const { data: allDecks } = useDecks();
  const [deckId, setDeckId] = useState(NO_DECK);
  const [deckCode, setDeckCode] = useState("");
  const [allowDeckPublishing, setAllowDeckPublishing] = useState(initialAllowDeckPublishing);
  const [allowNameSharing, setAllowNameSharing] = useState(initialAllowNameSharing);
  const [allowRiotIdSharing, setAllowRiotIdSharing] = useState(initialAllowRiotIdSharing);

  const decks = allDecks.filter((item) => item.deck.archivedAt === null);
  const deckItems = [
    { value: NO_DECK, label: m.tournaments_player_deck_pick_a_deck() },
    ...decks.map((item) => ({ value: item.deck.id, label: item.deck.name })),
  ];

  // The sources are mutually exclusive; touching one clears the other.
  const source: DeckSource | null = deckId === NO_DECK ? pasteToInput(deckCode) : { deckId };
  const input: DeckSourceInput | null = source
    ? { ...source, allowDeckPublishing, allowNameSharing, allowRiotIdSharing }
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="player-deck-select">{m.tournaments_player_deck_from_your_decks()}</Label>
        <Select
          items={deckItems}
          value={deckId}
          onValueChange={(value) => {
            setDeckId(value ?? NO_DECK);
            if (value && value !== NO_DECK) {
              setDeckCode("");
            }
          }}
        >
          <SelectTrigger id="player-deck-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {deckItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="player-deck-code">{m.tournaments_player_deck_or_paste()}</Label>
        <Textarea
          id="player-deck-code"
          value={deckCode}
          placeholder={`${m.tournaments_player_deck_paste_placeholder_lead()}\n\nChampion:\n1 Twisted Fate, Gambler\n\nMainDeck:\n3 Mystic Poro`}
          rows={7}
          onChange={(event) => {
            setDeckCode(event.target.value);
            if (event.target.value.trim().length > 0) {
              setDeckId(NO_DECK);
            }
          }}
        />
        <p className="text-muted-foreground text-sm">
          <ParaglideMessage
            message={m.tournaments_player_deck_paste_hint}
            markup={{
              link: ({ children }) => (
                <TextLink
                  variant="muted"
                  href="https://piltoverarchive.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  {children}
                </TextLink>
              ),
            }}
          />
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{m.tournaments_deck_check_public_sharing()}</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="player-deck-publish"
            checked={allowDeckPublishing}
            onCheckedChange={(checked) => setAllowDeckPublishing(checked === true)}
          />
          <Label htmlFor="player-deck-publish" className="font-normal">
            {m.tournaments_player_deck_publish_consent()}
          </Label>
        </div>
        <div className="ml-6 flex items-center gap-2">
          <Checkbox
            id="player-deck-share-name"
            checked={allowNameSharing}
            disabled={!allowDeckPublishing}
            onCheckedChange={(checked) => setAllowNameSharing(checked === true)}
          />
          <Label
            htmlFor="player-deck-share-name"
            className="font-normal data-[disabled]:opacity-50"
            data-disabled={!allowDeckPublishing || undefined}
          >
            {m.tournaments_player_deck_publish_name()}
          </Label>
        </div>
        <div className="ml-6 flex items-center gap-2">
          <Checkbox
            id="player-deck-share-riot-id"
            checked={allowRiotIdSharing}
            disabled={!allowDeckPublishing}
            onCheckedChange={(checked) => setAllowRiotIdSharing(checked === true)}
          />
          <Label
            htmlFor="player-deck-share-riot-id"
            className="font-normal data-[disabled]:opacity-50"
            data-disabled={!allowDeckPublishing || undefined}
          >
            {m.tournaments_player_deck_publish_riot_id()}
          </Label>
        </div>
        <p className="text-muted-foreground text-sm">{m.tournaments_player_deck_sharing_note()}</p>
      </div>

      {preview ? <PreviewSummary preview={preview} /> : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          disabled={!input || isPreviewing}
          onClick={() => input && onPreview(input)}
        >
          {isPreviewing
            ? m.tournaments_player_deck_checking()
            : m.tournaments_player_deck_preview()}
        </Button>
        <Button disabled={!input || isSubmitting} onClick={() => input && onSubmit(input)}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function PreviewSummary({ preview }: { preview: DeckCheckSubmissionResultResponse }) {
  const totalCopies = preview.cards.reduce((sum, card) => sum + card.quantity, 0);
  const unmatched = preview.cards.filter((card) => card.matchStatus !== "matched");
  return (
    <Callout className="flex flex-col gap-2 text-sm">
      <p>
        {m.tournaments_player_deck_preview_counts({
          copies: totalCopies,
          lines: preview.cards.length,
        })}
      </p>
      {unmatched.length > 0 ? (
        <p className="flex items-start gap-1.5">
          <TriangleAlertIcon className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            {m.tournaments_player_deck_preview_unmatched({
              names: unmatched.map((card) => card.rawName).join(", "),
            })}
          </span>
        </p>
      ) : null}
      {preview.violations.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {preview.violations.map((violation) => (
            <li key={`${violation.zone}:${violation.code}:${violation.cardId ?? ""}`}>
              {violation.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{m.tournaments_player_deck_preview_no_warnings()}</p>
      )}
      <p className="text-muted-foreground">{m.tournaments_player_deck_preview_advisory()}</p>
    </Callout>
  );
}
