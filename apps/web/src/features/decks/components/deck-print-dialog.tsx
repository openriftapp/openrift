import { legendDisplayName } from "@openrift/shared/card-name";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, PrinterIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { CardPlaceholderImage } from "@/features/cards/components/card-placeholder-image";
import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import type { CatalogEntry } from "@/features/cards/lib/catalog-queries";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useLocalDeckImageBody } from "@/features/decks/hooks/use-local-deck-image-body";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { sortCardsLikeSidebar } from "@/features/decks/lib/deck-card-sort";
import type { LocalDeckImageBody } from "@/features/decks/lib/local-deck-image-body";
import { isLocalDeck } from "@/features/decks/lib/local-decks-collection";
import type { PublicDeckSource } from "@/features/decks/lib/public-deck-source";
import type {
  RegistrationFields,
  RegistrationPageSize,
} from "@/features/decks/lib/registration-pdf";
import { useSession } from "@/hooks/use-session";
import { downloadFilename } from "@/lib/download";
import type { RenderHandoff } from "@/lib/html-capture";
import { captureElementCanvas, createRenderHandoff } from "@/lib/html-capture";
import { initQueryOptions } from "@/lib/init-queries";
import { effectiveLanguageOrder } from "@/lib/language-order";
import type { ProxyCard, ProxyPageSize, ProxyRenderMode, RenderedCard } from "@/lib/proxy-pdf";
import type { DeckImageOptions } from "@/lib/share-image";
import {
  deckImageFromCardsUrl,
  deckOwnerImageUrl,
  deckShareImageUrl,
  fetchImageBlob,
  fetchImageBlobFromPost,
} from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

function tabDescriptions(): Record<"proxies" | "registration", string> {
  return {
    proxies: m.decks_dialog_print_desc_proxies(),
    registration: m.decks_dialog_print_desc_registration(),
  };
}

function renderModeLabels(): Record<ProxyRenderMode, string> {
  return {
    image: m.decks_dialog_print_render_image(),
    text: m.decks_dialog_print_render_text(),
  };
}

function pageSizeLabels(): Record<ProxyPageSize, string> {
  return {
    a4: "A4",
    letter: m.decks_dialog_print_page_letter(),
  };
}

// Full render width for html2canvas capture (px)
const RENDER_WIDTH_PX = 504;

/**
 * Dynamic import at module scope: react-compiler can't lower an `import()` inside a component
 * and bails on the whole file, and eager import would put jsPDF on every deck tile's page.
 */
async function loadRegistrationPdfGenerator() {
  const module = await import("@/features/decks/lib/registration-pdf");
  return module.generateRegistrationPdf;
}

/** Module scope for the same reasons as loadRegistrationPdfGenerator above. */
async function loadImagePdfDownloader() {
  const module = await import("@/lib/image-pdf");
  return module.downloadImageAsPdf;
}

/** The element must already be in the page's React tree (with all providers). */
async function captureElement(element: HTMLElement): Promise<string> {
  const canvas = await captureElementCanvas(element);
  return canvas.toDataURL("image/png");
}

interface RenderingCard {
  card: ProxyCard;
  key: string;
}

interface GenerateProxyPdfParams {
  cards: DeckBuilderCard[];
  catalog: CatalogResponse;
  languages: string[];
  renderMode: ProxyRenderMode;
  pageSize: ProxyPageSize;
  cutLines: boolean;
  watermark: boolean;
  deckName: string | undefined;
  deckId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  renderHandoff: RenderHandoff;
  setProgress: (progress: { current: number; total: number }) => void;
  setRendering: (rendering: RenderingCard | null) => void;
  setPreviewUrl: (url: string | null) => void;
}

/**
 * Lives at module scope: react-compiler bails on "value blocks within try/catch"
 * when this mixed async/branch/try-catch control flow sits inside the component.
 */
async function generateProxyPdf({
  cards,
  catalog,
  languages,
  renderMode,
  pageSize,
  cutLines,
  watermark,
  deckName,
  deckId,
  queryClient,
  renderHandoff,
  setProgress,
  setRendering,
  setPreviewUrl,
}: GenerateProxyPdfParams): Promise<void> {
  const { assembleProxyPdf, prerenderImageCards, proxyRenderKey, resolveProxyCards } =
    await import("@/lib/proxy-pdf");
  // Pre-fetch so CardText doesn't suspend during rendering.
  const init = await queryClient.query({ ...initQueryOptions, staleTime: "static" });
  const languageRows = init.enums.languages;
  const languageOrder = effectiveLanguageOrder(languages, languageRows);
  const zoneRows = init.enums.deckZones;
  const zoneOrder = zoneRows
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .map((zone) => zone.slug as DeckBuilderCard["zone"]);

  const orderedCards = sortCardsLikeSidebar(cards, zoneOrder);
  const proxyCards = resolveProxyCards(orderedCards, catalog, languageOrder);
  const renderedCards = new Map<string, RenderedCard>();

  if (renderMode === "image") {
    const imageCards = await prerenderImageCards(proxyCards, (current, total) => {
      setProgress({ current, total });
    });
    imageCards.forEach((rendered, key) => {
      renderedCards.set(key, rendered);
    });
  } else {
    const seenKeys = new Set<string>();
    const uniqueCards: ProxyCard[] = [];
    for (const proxyCard of proxyCards) {
      const key = proxyRenderKey(proxyCard);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueCards.push(proxyCard);
      }
    }

    for (const [cardIdx, proxyCard] of uniqueCards.entries()) {
      setProgress({ current: cardIdx + 1, total: uniqueCards.length });

      const key = proxyRenderKey(proxyCard);
      setRendering({ card: proxyCard, key });
      const element = await renderHandoff.waitFor(key);
      try {
        const dataUrl = await captureElement(element);
        renderedCards.set(key, { dataUrl, rotated: false });
        setPreviewUrl(dataUrl);
      } catch (error) {
        console.error(`Failed to capture card "${proxyCard.name}":`, error);
      }
    }

    setRendering(null);
  }

  if (renderMode === "image") {
    const missingCards = proxyCards.filter(
      (proxyCard) => !renderedCards.has(proxyRenderKey(proxyCard)),
    );
    const uniqueMissing = new Map<string, ProxyCard>();
    for (const proxyCard of missingCards) {
      const key = proxyRenderKey(proxyCard);
      if (!uniqueMissing.has(key)) {
        uniqueMissing.set(key, proxyCard);
      }
    }

    for (const proxyCard of uniqueMissing.values()) {
      const key = proxyRenderKey(proxyCard);
      setRendering({ card: proxyCard, key });
      const element = await renderHandoff.waitFor(key);
      try {
        const dataUrl = await captureElement(element);
        renderedCards.set(key, { dataUrl, rotated: false });
        setPreviewUrl(dataUrl);
      } catch (error) {
        console.error(`Failed to capture fallback card "${proxyCard.name}":`, error);
      }
    }
    setRendering(null);
  }

  await assembleProxyPdf(proxyCards, renderedCards, {
    pageSize,
    renderMode,
    cutLines,
    watermark,
    deckName,
    deckId,
  });
}

function ProxyPrintPanel({
  cards,
  deckId,
  deckName,
  onDone,
}: {
  cards: DeckBuilderCard[];
  deckId: string;
  deckName: string;
  onDone: () => void;
}) {
  const [renderMode, setRenderMode] = useState<ProxyRenderMode>("image");
  const [pageSize, setPageSize] = useState<ProxyPageSize>("a4");
  const [cutLines, setCutLines] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [rendering, setRendering] = useState<RenderingCard | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // oxlint-disable-next-line react/hook-use-state -- a stable per-mount handoff, never replaced
  const [renderHandoff] = useState(createRenderHandoff);
  const queryClient = useQueryClient();
  const languages = useDisplayStore((state) => state.languages);

  const handleGenerate = async () => {
    if (cards.length === 0) {
      return;
    }

    const catalog = queryClient.getQueryData<CatalogEntry>(catalogKeys.all)?.catalog;
    if (!catalog) {
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: 0 });
    setPreviewUrl(null);

    try {
      await generateProxyPdf({
        cards,
        catalog,
        languages,
        renderMode,
        pageSize,
        cutLines,
        watermark,
        deckName,
        deckId,
        queryClient,
        renderHandoff,
        setProgress,
        setRendering,
        setPreviewUrl,
      });
      onDone();
    } catch (error) {
      setGenerating(false);
      setRendering(null);
      throw error;
    }
    setGenerating(false);
    setRendering(null);
  };

  return (
    <DialogForm onSubmit={() => void handleGenerate()}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="proxy-render-mode">{m.decks_dialog_print_render_mode()}</Label>
          <SimpleSelect
            id="proxy-render-mode"
            items={Object.entries(renderModeLabels()).map(([value, label]) => ({
              value: value as ProxyRenderMode,
              label,
            }))}
            value={renderMode}
            onChange={setRenderMode}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="proxy-page-size">{m.decks_dialog_print_page_size()}</Label>
          <SimpleSelect
            id="proxy-page-size"
            items={Object.entries(pageSizeLabels()).map(([value, label]) => ({
              value: value as ProxyPageSize,
              label,
            }))}
            value={pageSize}
            onChange={setPageSize}
            className="w-full"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="proxy-cut-lines">{m.decks_dialog_print_cut_lines()}</Label>
          <Switch id="proxy-cut-lines" checked={cutLines} onCheckedChange={setCutLines} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="proxy-watermark">{m.decks_dialog_print_watermark()}</Label>
          <Switch id="proxy-watermark" checked={watermark} onCheckedChange={setWatermark} />
        </div>

        {previewUrl && (
          <div className="flex justify-center">
            <ImgWithFallback
              src={previewUrl}
              alt={m.decks_dialog_print_preview_alt()}
              className="aspect-card w-48 rounded-md"
              fallback={null}
            />
          </div>
        )}

        <Button
          type="submit"
          className="self-start"
          pending={generating}
          disabled={cards.length === 0}
        >
          <PrinterIcon className="size-4" />
          {generating
            ? progress.total > 0
              ? m.decks_dialog_print_rendering({
                  current: progress.current,
                  total: progress.total,
                })
              : m.decks_dialog_print_generating()
            : m.decks_dialog_print_generate_pdf()}
        </Button>
      </div>

      {/* Portalled out of the dialog so the popup's transform/scroll box can't clip it. */}
      {rendering &&
        createPortal(
          <Suspense fallback={null}>
            <div
              key={rendering.key}
              ref={(element) => renderHandoff.report(rendering.key, element)}
              style={{
                position: "fixed",
                left: -9999,
                top: 0,
                width: RENDER_WIDTH_PX,
                pointerEvents: "none",
              }}
            >
              <CardPlaceholderImage
                name={legendDisplayName(rendering.card.card)}
                domain={rendering.card.card.domains}
                energy={rendering.card.card.energy}
                might={rendering.card.card.might}
                power={rendering.card.card.power}
                types={rendering.card.card.types}
                superTypes={rendering.card.card.superTypes}
                tags={rendering.card.card.tags}
                rulesText={rendering.card.rulesText}
                effectText={rendering.card.effectText}
                mightBonus={rendering.card.card.mightBonus}
                flavorText={rendering.card.flavorText}
                rarity={rendering.card.rarity}
                publicCode={rendering.card.publicCode}
                artist={rendering.card.artist}
              />
            </div>
          </Suspense>,
          document.body,
        )}
    </DialogForm>
  );
}

function RegistrationPrintPanel({
  cards,
  deckId,
  deckName,
}: {
  cards: DeckBuilderCard[];
  deckId: string;
  deckName: string;
}) {
  const { data: session } = useSession();
  const nameParts = (session?.user?.name ?? "").trim().split(/\s+/u);

  const [regDeckName, setRegDeckName] = useState(deckName);
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [riotId, setRiotId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [deckDesigner, setDeckDesigner] = useState("");
  const [pageSize, setPageSize] = useState<RegistrationPageSize>("a4");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (cards.length === 0) {
      return;
    }
    setGenerating(true);
    const fields: RegistrationFields = {
      deckName: regDeckName,
      deckDesigner,
      firstName,
      lastName,
      riotId,
      eventDate,
      eventName,
      eventLocation,
    };
    const generateRegistrationPdf = await loadRegistrationPdfGenerator();
    try {
      await generateRegistrationPdf(fields, cards, pageSize, getSiteUrl(), deckId);
    } catch (error) {
      setGenerating(false);
      throw error;
    }
    setGenerating(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="reg-deck-name">{m.decks_dialog_print_reg_deck_name()}</Label>
          <Input
            id="reg-deck-name"
            value={regDeckName}
            onChange={(event) => setRegDeckName(event.target.value)}
            placeholder={m.decks_dialog_print_reg_deck_name_placeholder()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-first-name">{m.decks_dialog_print_reg_first_name()}</Label>
          <Input
            id="reg-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-last-name">{m.decks_dialog_print_reg_last_name()}</Label>
          <Input
            id="reg-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="reg-riot-id">Riot ID</Label>
          <Input
            id="reg-riot-id"
            value={riotId}
            onChange={(event) => setRiotId(event.target.value)}
            placeholder="Name#TAG"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-event-date">{m.decks_dialog_print_reg_event_date()}</Label>
          <DatePicker id="reg-event-date" value={eventDate || null} onValueChange={setEventDate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-event-name">{m.decks_dialog_print_reg_event_name()}</Label>
          <Input
            id="reg-event-name"
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="reg-event-location">{m.decks_dialog_print_reg_event_location()}</Label>
          <Input
            id="reg-event-location"
            value={eventLocation}
            onChange={(event) => setEventLocation(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-deck-designer">{m.decks_dialog_print_reg_deck_designer()}</Label>
          <Input
            id="reg-deck-designer"
            value={deckDesigner}
            onChange={(event) => setDeckDesigner(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="registration-page-size">{m.decks_dialog_print_page_size()}</Label>
          <SimpleSelect
            id="registration-page-size"
            items={Object.entries(pageSizeLabels()).map(([value, label]) => ({
              value: value as RegistrationPageSize,
              label,
            }))}
            value={pageSize}
            onChange={setPageSize}
            className="w-full"
          />
        </div>
      </div>

      <Button
        className="self-start"
        onClick={() => void handleGenerate()}
        pending={generating}
        disabled={cards.length === 0}
      >
        <FileTextIcon className="size-4" />
        {m.decks_dialog_print_download_pdf()}
      </Button>
    </div>
  );
}

function fetchSheetImage(
  deckId: string,
  publicSource: PublicDeckSource | undefined,
  options: DeckImageOptions,
  imageBody: () => LocalDeckImageBody,
): Promise<Blob> {
  if (publicSource) {
    return fetchImageBlob(
      deckShareImageUrl(getSiteUrl(), publicSource.shareToken, publicSource.imageVersion, options),
    );
  }
  if (isLocalDeck(deckId)) {
    return fetchImageBlobFromPost(deckImageFromCardsUrl(getSiteUrl(), options), imageBody());
  }
  return fetchImageBlob(deckOwnerImageUrl(getSiteUrl(), deckId, options));
}

export function DeckSheetPrintPanel({
  deckId,
  deckName,
  cards,
  publicSource,
  isShared = false,
}: {
  deckId: string;
  deckName: string;
  cards?: DeckBuilderCard[];
  publicSource?: PublicDeckSource;
  isShared?: boolean;
}) {
  const isLocal = useIsLocalDeck(deckId);
  const qrAvailable = !isLocal && (publicSource !== undefined || isShared);
  const imageBody = useLocalDeckImageBody(deckId, deckName, cards);
  const [qr, setQr] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    const options = { size: "hq" as const, qr: qrAvailable && qr };
    const blob = fetchSheetImage(deckId, publicSource, options, imageBody);
    const filename = `${downloadFilename({ base: deckName, fallback: "deck", id: deckId })}-sheet.pdf`;
    // React Compiler can't yet lower try/finally, so reset in both paths.
    try {
      const downloadImageAsPdf = await loadImagePdfDownloader();
      await downloadImageAsPdf(await blob, filename);
      setDownloading(false);
    } catch {
      toast.error(m.decks_dialog_print_pdf_failed());
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{m.decks_dialog_print_sheet_description()}</p>
      {qrAvailable && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="deck-sheet-include-qr"
            checked={qr}
            onCheckedChange={(checked) => setQr(checked === true)}
          />
          <label htmlFor="deck-sheet-include-qr" className="cursor-pointer text-sm">
            {m.decks_dialog_print_sheet_qr_label()}
          </label>
        </div>
      )}
      <Button className="self-start" onClick={() => void handleDownload()} pending={downloading}>
        <PrinterIcon className="size-4" />
        {m.decks_dialog_print_download_pdf()}
      </Button>
    </div>
  );
}

export type DeckPrintKind = "proxies" | "registration";

interface DeckPrintDialogProps {
  kind: DeckPrintKind;
  deckId: string;
  deckName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards?: DeckBuilderCard[];
}

function printTitles(): Record<DeckPrintKind, string> {
  return {
    proxies: m.decks_dialog_print_title_proxies(),
    registration: m.decks_dialog_print_title_registration(),
  };
}

export function DeckPrintDialog({
  kind,
  deckId,
  deckName,
  open,
  onOpenChange,
  cards: cardsProp,
}: DeckPrintDialogProps) {
  // Subscribing only when cardsProp is omitted keeps the deck-list menus from
  // opening one draft per row; the editor still gets the live draft.
  const liveCards = useDeckCards(cardsProp === undefined ? deckId : "");
  const cards = cardsProp ?? liveCards;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{printTitles()[kind]}</DialogTitle>
          <DialogDescription>{tabDescriptions()[kind]}</DialogDescription>
        </DialogHeader>
        {kind === "proxies" ? (
          <ProxyPrintPanel
            cards={cards}
            deckId={deckId}
            deckName={deckName}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <RegistrationPrintPanel cards={cards} deckId={deckId} deckName={deckName} />
        )}
      </DialogContent>
    </Dialog>
  );
}
