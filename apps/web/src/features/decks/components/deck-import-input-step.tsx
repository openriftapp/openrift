import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { RefObject } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextLink } from "@/components/ui/text-link";
import { ImportTextInput } from "@/features/collections/components/import-preview-chrome";
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
      <ParaglideMessage
        message={m.collections_import_deck_desc_piltover}
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
    ),
    text: <>{m.collections_import_deck_desc_text()}</>,
    tts: (
      <ParaglideMessage
        message={m.collections_import_deck_desc_tts}
        markup={{
          link: ({ children }) => (
            <a
              href="https://steamcommunity.com/sharedfiles/filedetails/?id=3606647746"
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
              <ParaglideMessage
                message={m.collections_import_deck_replace_hint}
                inputs={{
                  deck: replaceDeckName
                    ? `“${replaceDeckName}”`
                    : m.collections_import_deck_replace_this_deck(),
                }}
                markup={{
                  strong: ({ children }) =>
                    replaceDeckName ? (
                      <strong className="text-foreground">{children}</strong>
                    ) : (
                      children
                    ),
                }}
              />
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
          <ImportTextInput
            value={rawText}
            onValueChange={onTextChange}
            placeholder={importPlaceholders()[importMode]}
            textareaClassName={
              importMode === "piltover" ? "min-h-[120px]" : "min-h-[240px] sm:min-h-[320px]"
            }
            fileRef={fileRef}
            onFileUpload={onFileUpload}
            uploadLabel={m.collections_import_upload_file()}
            actionLabel={m.collections_import_parse()}
            onAction={() => onParse(rawText)}
            actionPending={isParsing}
            errors={parseWarnings}
          />
        </div>
      </div>
    </>
  );
}
