import { FileUpIcon, Loader2Icon, UploadIcon } from "lucide-react";
import type { RefObject } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { DeckImportMode } from "@/features/decks/lib/deck-import-modes";
import {
  importModeLabels,
  IMPORT_MODE_ORDER,
  importPlaceholders,
} from "@/features/decks/lib/deck-import-modes";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function importDescriptions(): Record<DeckImportMode, React.ReactNode> {
  return {
    auto: <>{m.collections_import_deck_desc_auto()}</>,
    piltover: (
      <>
        {m.collections_import_deck_desc_piltover_before()}{" "}
        <TextLink
          variant="muted"
          href="https://piltoverarchive.com"
          target="_blank"
          rel="noreferrer"
        >
          Piltover Archive
        </TextLink>
        . {m.collections_import_deck_desc_piltover_after()}
      </>
    ),
    text: <>{m.collections_import_deck_desc_text()}</>,
    tts: (
      <>
        {m.collections_import_deck_desc_tts_before()}{" "}
        <a
          href="https://steamcommunity.com/sharedfiles/filedetails/?id=3606647746"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline"
        >
          {m.collections_import_deck_desc_tts_link()}
        </a>
        .
      </>
    ),
  };
}

export function DeckImportInputStep({
  rawText,
  onTextChange,
  importMode,
  onImportModeChange,
  onParse,
  onFileUpload,
  fileRef,
  isParsing,
  parseWarnings,
  replaceDeckName,
}: {
  rawText: string;
  onTextChange: (text: string) => void;
  importMode: DeckImportMode;
  onImportModeChange: (mode: DeckImportMode) => void;
  onParse: (text: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  isParsing: boolean;
  parseWarnings: string[];
  replaceDeckName?: string;
}) {
  const isReplaceMode = replaceDeckName !== undefined;
  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>
            {isReplaceMode
              ? m.collections_import_deck_replace_title()
              : m.collections_import_deck_title()}
          </PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "space-y-6 pt-3", PAGE_PADDING_NO_TOP)}>
        <PageDescription>
          {isReplaceMode ? (
            <>
              {m.collections_import_deck_paste_hint()}{" "}
              {m.collections_import_deck_replace_hint_before()}
              {replaceDeckName ? (
                <>
                  {" "}
                  <strong className="text-foreground">&ldquo;{replaceDeckName}&rdquo;</strong>
                </>
              ) : (
                ` ${m.collections_import_deck_replace_this_deck()}`
              )}{" "}
              {m.collections_import_deck_replace_hint_after()}
            </>
          ) : (
            <>{m.collections_import_deck_paste_hint()}</>
          )}
        </PageDescription>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="import-mode">{m.collections_import_deck_format_label()}</Label>
            <Select
              value={importMode}
              onValueChange={(value) => {
                if (value !== null) {
                  onImportModeChange(value as DeckImportMode);
                }
              }}
              items={importModeLabels()}
            >
              <SelectTrigger id="import-mode" className="mb-0 w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_MODE_ORDER.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {importModeLabels()[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-muted-foreground">{importDescriptions()[importMode]}</p>
          <Textarea
            value={rawText}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={importPlaceholders()[importMode]}
            className={cn(
              // text-base below md: iOS Safari zooms the viewport when a focused
              // field is under 16px, and there is no maximum-scale to stop it.
              "font-mono text-base md:text-xs",
              importMode === "piltover" ? "min-h-[120px]" : "min-h-[240px] sm:min-h-[320px]",
            )}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => onParse(rawText)}
              disabled={rawText.trim().length === 0 || isParsing}
            >
              {isParsing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <UploadIcon className="size-4" />
              )}
              {m.collections_import_parse()}
            </Button>

            <div className="text-muted-foreground text-sm">{m.collections_import_or()}</div>

            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUpIcon className="size-4" />
              {m.collections_import_upload_file()}
            </Button>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              onChange={onFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {parseWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {parseWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
