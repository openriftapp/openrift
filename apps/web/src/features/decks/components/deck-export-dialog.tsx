import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { DeckExportResponse } from "@openrift/shared/types/api/deck";
import { useEffect, useEffectEvent, useState } from "react";

import { CopyTextPanel } from "@/components/copy-text-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useEncodeDeckCards, useExportDeck } from "@/features/decks/hooks/use-decks";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import type { PublicDeckSource } from "@/features/decks/lib/public-deck-source";
import { m } from "@/paraglide/messages.js";

type ExportFormat = "piltover" | "text" | "tts";

function formatDescriptions(): Record<ExportFormat, React.ReactNode> {
  return {
    piltover: (
      <>
        {m.decks_dialog_export_desc_piltover()}{" "}
        <TextLink
          variant="muted"
          href="https://piltoverarchive.com"
          target="_blank"
          rel="noreferrer"
        >
          Piltover Archive
        </TextLink>
        .
      </>
    ),
    text: (
      <ParaglideMessage
        message={m.decks_dialog_export_desc_text}
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
          link2: ({ children }) => (
            <a
              href="https://tcg-arena.fr/decks"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              {children}
            </a>
          ),
        }}
      />
    ),
    tts: (
      <>
        {m.decks_dialog_export_desc_tts()}{" "}
        <a
          href="https://steamcommunity.com/sharedfiles/filedetails/?id=3606647746"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline"
        >
          {m.decks_dialog_export_desc_tts_link()}
        </a>
        .
      </>
    ),
  };
}

export interface ExportExtraOption {
  label: string;
  description: string;
  cards: DeckBuilderCard[];
}

function exportCacheKey(format: string | undefined, extraCardIds: readonly string[]): string {
  return `${format ?? "piltover"}:${extraCardIds.toSorted().join(",")}`;
}

function exportEmptyNote(failed: boolean, data?: DeckExportResponse): string | undefined {
  if (failed) {
    return m.decks_dialog_export_failed();
  }
  return data === undefined ? undefined : m.decks_dialog_export_empty();
}

interface DeckExportDialogProps {
  deckId: string;
  isDirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards?: DeckBuilderCard[];
  extraOptions?: ExportExtraOption[];
  publicSource?: PublicDeckSource;
}

/**
 * Export dialog for the machine-readable deck data. The share image lives in
 * the share dialog and every PDF in the print dialog.
 */
export function DeckExportDialog({
  deckId,
  isDirty,
  open,
  onOpenChange,
  cards: cardsProp,
  extraOptions = [],
  publicSource,
}: DeckExportDialogProps) {
  const exportDeck = useExportDeck();
  // A local deck or one reached by share token has no server row to export by
  // id; encode its cards through the public endpoint instead.
  const encodeDeck = useEncodeDeckCards();
  const isLocal = useIsLocalDeck(deckId);
  const fromCards = publicSource !== undefined || isLocal;
  // Subscribing the draft of a deck the viewer doesn't own would fetch someone
  // else's deck, and a caller bringing its own cards never reads it anyway.
  const liveCards = useDeckCards(cardsProp === undefined ? deckId : "");
  const [tab, setTab] = useState<ExportFormat>("text");
  const [formats, setFormats] = useState<Partial<Record<string, DeckExportResponse>>>({});
  const [extraIndex, setExtraIndex] = useState(-1);
  const extraCards = extraOptions[extraIndex]?.cards ?? [];

  // Closing discards everything the dialog built up. The local drafts reset
  // during render; the two mutations are external and reset in the effect.
  const [seededOpen, setSeededOpen] = useState(open);
  if (seededOpen !== open) {
    setSeededOpen(open);
    if (!open) {
      setTab("text");
      setFormats({});
      setExtraIndex(-1);
    }
  }
  const discardMutations = useEffectEvent(() => {
    exportDeck.reset();
    encodeDeck.reset();
  });
  useEffect(() => {
    if (open) {
      return;
    }
    discardMutations();
  }, [open]);

  // In-flight/failed state is read off the mutation, not `formats`, which
  // only caches the code each format came back with.
  const exportMutation = fromCards ? encodeDeck : exportDeck;
  const pending = exportMutation.variables;
  const pendingKey =
    pending === undefined
      ? undefined
      : exportCacheKey(
          pending.format,
          "cards" in pending
            ? pending.cards.filter((card) => card.inferred === true).map((card) => card.cardId)
            : [],
        );

  // Reads the deck as it stands when a format is first opened, not
  // reactively, or an edit behind the dialog refetches mid-copy.
  const fetchFormat = useEffectEvent((format: ExportFormat, index: number) => {
    const extras = extraOptions[index]?.cards ?? [];
    const key = exportCacheKey(
      format,
      extras.map((card) => card.cardId),
    );
    if (formats[key] || (exportMutation.isPending && pendingKey === key)) {
      return;
    }
    const onSuccess = (data: DeckExportResponse) => {
      setFormats((prev) => ({ ...prev, [key]: data }));
    };
    if (fromCards) {
      encodeDeck.mutate(
        {
          format,
          cards: [...toEncodeDeckCards(cardsProp ?? liveCards), ...toEncodeDeckCards(extras, true)],
        },
        { onSuccess },
      );
    } else {
      exportDeck.mutate({ deckId, format }, { onSuccess });
    }
  });
  useEffect(() => {
    if (!open) {
      return;
    }
    fetchFormat(tab, extraIndex);
  }, [open, tab, extraIndex]);

  const currentKey = exportCacheKey(
    tab,
    extraCards.map((card) => card.cardId),
  );
  const currentData = formats[currentKey];
  const isCurrentTab = pendingKey === currentKey;
  const currentLoading = exportMutation.isPending && isCurrentTab;
  const currentError = exportMutation.isError && isCurrentTab;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Tabs
          defaultValue="text"
          value={tab}
          onValueChange={(value) => setTab(value as ExportFormat)}
        >
          <DialogHeader>
            <DialogTitle>{m.decks_dialog_export_title()}</DialogTitle>
            <TabsList>
              <TabsTrigger value="text">{m.decks_dialog_export_tab_text()}</TabsTrigger>
              <TabsTrigger value="piltover">{m.decks_dialog_export_tab_code()}</TabsTrigger>
              <TabsTrigger value="tts">TTS</TabsTrigger>
            </TabsList>
            <DialogDescription>{formatDescriptions()[tab]}</DialogDescription>
          </DialogHeader>

          {isDirty && (
            <p className="text-muted-foreground text-sm">{m.decks_dialog_export_dirty_note()}</p>
          )}

          <TabsContent value={tab}>
            <div className="flex min-w-0 flex-col gap-3">
              {extraOptions.length > 0 && (
                <div className="flex flex-col gap-1">
                  <RadioGroup
                    value={String(extraIndex)}
                    onValueChange={(value) => setExtraIndex(Number(value))}
                    className="flex flex-col gap-2"
                  >
                    <RadioOptionRow
                      value="-1"
                      title={m.decks_dialog_export_as_listed()}
                      description={m.decks_dialog_export_as_listed_desc()}
                    />
                    {extraOptions.map((option, index) => (
                      <RadioOptionRow
                        key={option.label}
                        value={String(index)}
                        title={option.label}
                        description={option.description}
                      />
                    ))}
                  </RadioGroup>
                  {extraCards.length > 0 && tab !== "text" && (
                    <p className="text-muted-foreground text-sm">
                      {m.decks_dialog_export_inferred_unmarked()}
                    </p>
                  )}
                </div>
              )}
              <CopyTextPanel
                key={tab}
                text={currentData?.code ?? ""}
                rows={8}
                isLoading={currentLoading}
                emptyNote={exportEmptyNote(currentError, currentData)}
              />

              {currentData && currentData.warnings.length > 0 && (
                <div className="text-muted-foreground text-xs">
                  <p className="font-medium">{m.decks_dialog_export_warnings()}</p>
                  <ul className="mt-1 list-inside list-disc">
                    {currentData.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
