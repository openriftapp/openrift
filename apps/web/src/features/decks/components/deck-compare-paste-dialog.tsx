import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { DeckLinkKind } from "@/features/decks/lib/deck-compare-side";
import { compareLinkParam, queryDeckLink } from "@/features/decks/lib/deck-compare-side";
import { diffCardsFromEntries } from "@/features/decks/lib/deck-compare-sources";
import type { DeckDiffCard } from "@/features/decks/lib/deck-diff";
import type { DeckImportEntry } from "@/features/decks/lib/deck-import-parsers";
import {
  extractDeckFromUrl,
  parseDeckImportData,
  sniffDeckImportFormat,
} from "@/features/decks/lib/deck-import-parsers";
import { m } from "@/paraglide/messages.js";

/** A list pasted into the comparison, held only for the session; not persisted. */
export interface PastedCompareSource {
  cards: DeckDiffCard[];
  unmatched: string[];
  text: string;
}

/** The parsed entries, a public deck to put in the URL, or the message to show instead. */
type EntriesResult = { entries: DeckImportEntry[] } | { link: string } | { error: string };

/** Loads the deck once so a dead or empty link errors here; the page then reads it from the cache. */
async function checkDeckLink(
  queryClient: QueryClient,
  kind: DeckLinkKind,
  token: string,
): Promise<EntriesResult> {
  try {
    const data = await queryDeckLink(queryClient, kind, token);
    if (data.cards.length === 0) {
      return { error: m.decks_compare_error_shared_empty() };
    }
    return { link: compareLinkParam(kind, token) };
  } catch {
    return { error: m.decks_compare_error_shared_load() };
  }
}

/** An OpenRift deck link becomes a linkable side; another URL yields the deck code embedded in it; anything else is sniffed and parsed by the same codecs the import page uses. */
async function resolveCompareEntries(
  queryClient: QueryClient,
  text: string,
): Promise<EntriesResult> {
  const urlSniff = extractDeckFromUrl(text);
  if (urlSniff?.kind === "share-token") {
    return await checkDeckLink(queryClient, "share", urlSniff.token);
  }
  if (urlSniff?.kind === "meta-token") {
    return await checkDeckLink(queryClient, "meta", urlSniff.token);
  }
  if (urlSniff?.kind === "url-no-deck") {
    return { error: m.decks_compare_error_no_deck_in_url() };
  }
  const source = urlSniff?.kind === "deck-code" ? urlSniff.code : text;
  const format = urlSniff?.kind === "deck-code" ? "piltover" : sniffDeckImportFormat(source);
  const { entries } = parseDeckImportData(source, format);
  if (entries.length === 0) {
    return { error: m.decks_compare_error_unreadable() };
  }
  return { entries };
}

export function DeckComparePasteDialog({
  open,
  onOpenChange,
  onResolved,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (source: PastedCompareSource) => void;
  onLinked: (sideParam: string) => void;
}) {
  const queryClient = useQueryClient();
  const { allPrintings } = useCards();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seededOpen, setSeededOpen] = useState(open);
  if (seededOpen !== open) {
    setSeededOpen(open);
    if (!open) {
      setText("");
      setPending(false);
      setError(null);
    }
  }

  const handleCompare = async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    setPending(true);
    setError(null);
    const entriesResult = await resolveCompareEntries(queryClient, trimmed);
    setPending(false);
    if ("error" in entriesResult) {
      setError(entriesResult.error);
      return;
    }
    if ("link" in entriesResult) {
      onLinked(entriesResult.link);
      onOpenChange(false);
      return;
    }
    const resolved = diffCardsFromEntries(entriesResult.entries, allPrintings);
    if (resolved.cards.length === 0) {
      setError(m.decks_compare_error_no_matches());
      return;
    }
    onResolved({ ...resolved, text: trimmed });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.decks_compare_paste_title()}</DialogTitle>
          <DialogDescription>{m.decks_compare_paste_description()}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={m.decks_compare_paste_placeholder()}
          className="field-sizing-fixed text-sm"
          rows={8}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          className="self-end"
          onClick={() => void handleCompare()}
          disabled={pending || text.trim().length === 0}
        >
          {pending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              {m.decks_compare_reading()}
            </>
          ) : (
            m.decks_compare_use_this_list()
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
