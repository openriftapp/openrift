import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { DeckExportResponse } from "@openrift/shared/types/api/deck";
import { CheckIcon, CopyIcon, Loader2Icon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useEncodeDeckCards, useExportDeck } from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import { isLocalDeckId } from "@/features/decks/lib/local-deck";
import type { PublicDeckSource } from "@/features/decks/lib/public-deck-source";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
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

interface DeckExportDialogProps {
  deckId: string;
  isDirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards?: DeckBuilderCard[];
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
  publicSource,
}: DeckExportDialogProps) {
  const exportDeck = useExportDeck();
  // A local deck or one reached by share token has no server row to export by
  // id; encode its cards through the public endpoint instead.
  const encodeDeck = useEncodeDeckCards();
  const fromCards = publicSource !== undefined || isLocalDeckId(deckId);
  // Subscribing the draft of a deck the viewer doesn't own would fetch someone
  // else's deck, and a caller bringing its own cards never reads it anyway.
  const liveCards = useDeckCards(cardsProp === undefined ? deckId : "");
  const { copied, copy, reset: resetCopied } = useCopyToClipboard();
  const [tab, setTab] = useState<ExportFormat>("text");
  const [formats, setFormats] = useState<Partial<Record<ExportFormat, DeckExportResponse>>>({});

  // Closing discards everything the dialog built up. The local drafts reset
  // during render; the two mutations are external and reset in the effect.
  const [seededOpen, setSeededOpen] = useState(open);
  if (seededOpen !== open) {
    setSeededOpen(open);
    if (!open) {
      setTab("text");
      setFormats({});
    }
  }
  const discardMutations = useEffectEvent(() => {
    exportDeck.reset();
    encodeDeck.reset();
    resetCopied();
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

  // Reads the deck as it stands when a format is first opened, not
  // reactively, or an edit behind the dialog refetches mid-copy.
  const fetchFormat = useEffectEvent((format: ExportFormat) => {
    if (
      formats[format] ||
      (exportMutation.isPending && exportMutation.variables?.format === format)
    ) {
      return;
    }
    const onSuccess = (data: DeckExportResponse) => {
      setFormats((prev) => ({ ...prev, [format]: data }));
    };
    if (fromCards) {
      encodeDeck.mutate(
        { format, cards: toEncodeDeckCards(cardsProp ?? liveCards) },
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
    fetchFormat(tab);
  }, [open, tab]);

  const handleTabChange = (newTab: ExportFormat) => {
    setTab(newTab);
    resetCopied();
  };

  const currentData = formats[tab];
  const isCurrentTab = exportMutation.variables?.format === tab;
  const currentLoading = exportMutation.isPending && isCurrentTab;
  const currentError = exportMutation.isError && isCurrentTab;

  const handleCopy = () => {
    if (!currentData?.code) {
      return;
    }
    // Use \r\n so line breaks survive iOS Safari's clipboard
    void copy(currentData.code.replaceAll("\n", "\r\n"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Tabs
          defaultValue="text"
          value={tab}
          onValueChange={(value) => handleTabChange(value as ExportFormat)}
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
              <Textarea
                readOnly
                value={currentData?.code ?? ""}
                placeholder={currentError ? m.decks_dialog_export_failed() : ""}
                className="field-sizing-fixed font-mono text-xs break-all"
                rows={8}
                onClick={(event) => (event.target as HTMLTextAreaElement).select()}
              />

              <div className="flex items-center gap-2 self-end">
                {currentLoading && (
                  <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
                )}
                <Button onClick={handleCopy} disabled={!currentData}>
                  {copied ? (
                    <>
                      <CheckIcon className="size-4" />
                      {m.common_copied()}
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-4" />
                      {m.common_copy()}
                    </>
                  )}
                </Button>
              </div>

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
