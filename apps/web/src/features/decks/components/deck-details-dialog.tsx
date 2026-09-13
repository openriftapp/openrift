import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { MAX_DECK_LINKS } from "@openrift/shared/contracts/decks";
import { ALLOWED_LINK_SITE_NAMES, isAllowedLinkUrl } from "@openrift/shared/link-hosts";
import type { DeckLink } from "@openrift/shared/types/api/deck";
import { useRef, useState } from "react";

import type { LinkDraft } from "@/components/link-rows-field";
import { LinkRowsField } from "@/components/link-rows-field";
import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useQuickAddSearch } from "@/features/collections/hooks/use-quick-add-search";
import type { DeckMetaPatch } from "@/features/decks/hooks/use-decks";
import { useUpdateDeckMeta } from "@/features/decks/hooks/use-decks";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const DESCRIPTION_MAX = 8000;

/** How many card suggestions the [[ autocomplete shows. */
const AUTOCOMPLETE_LIMIT = 6;

const PREVIEW_CARD_LINK_CLASS =
  "text-foreground inline font-medium underline decoration-dotted underline-offset-2";

/** The `[[` token being typed at the caret, or null when the caret isn't inside an unclosed card reference. */
export function cardTokenAtCaret(value: string, caret: number): string | null {
  const upto = value.slice(0, caret);
  const match = /\[\[(?<token>[^[\]\n]{0,60})$/u.exec(upto);
  return match?.groups?.token ?? null;
}

function allowedHostsHint(): string {
  return m.decks_dialog_details_links_hint({ hosts: ALLOWED_LINK_SITE_NAMES.join(", ") });
}

function toDrafts(links: readonly DeckLink[]): LinkDraft[] {
  return links.map((link) => ({ url: link.url, title: link.title ?? "" }));
}

function toLinks(drafts: readonly LinkDraft[]): DeckLink[] {
  return drafts.map((draft) => {
    const title = draft.title.trim();
    return title === "" ? { url: draft.url.trim() } : { url: draft.url.trim(), title };
  });
}

interface DeckDetailsDialogProps {
  deckId: string;
  currentName: string;
  currentDescription: string | null;
  currentLinks: readonly DeckLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeckDetailsDialog({
  deckId,
  currentName,
  currentDescription,
  currentLinks,
  open,
  onOpenChange,
}: DeckDetailsDialogProps) {
  const [name, setName] = useState(currentName);
  const [draft, setDraft] = useState(currentDescription ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(() => toDrafts(currentLinks));
  const [pane, setPane] = useState<"write" | "preview">("write");
  const [token, setToken] = useState<string | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { update } = useUpdateDeckMeta(deckId);
  const { printingsByCardId } = useCards();

  // Unconditional, unlike the caret check that gates it: an empty query returns
  // no suggestions on its own, and a hook can't sit behind a ternary.
  const suggestions = useQuickAddSearch(token ?? "", printingsByCardId, {
    limit: AUTOCOMPLETE_LIMIT,
  });
  const clampedSuggestion = Math.min(suggestionIndex, Math.max(0, suggestions.length - 1));

  const filledLinks = links.filter((link) => link.url.trim() !== "");
  const linksValid = filledLinks.every((link) => isAllowedLinkUrl(link.url.trim()));

  const refreshToken = (element: HTMLTextAreaElement) => {
    const next = cardTokenAtCaret(element.value, element.selectionStart);
    if (next !== token) {
      setSuggestionIndex(0);
    }
    setToken(next);
  };

  const insertSuggestion = (cardName: string) => {
    const element = textareaRef.current;
    if (element === null || token === null) {
      return;
    }
    const caret = element.selectionStart;
    const start = draft.slice(0, caret).lastIndexOf("[[");
    if (start === -1) {
      return;
    }
    const next = `${draft.slice(0, start)}[[${cardName}]]${draft.slice(caret)}`;
    setDraft(next);
    setToken(null);
    // requestAnimationFrame waits for the controlled value to commit before the caret moves.
    const position = start + cardName.length + 4;
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(position, position);
    });
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionIndex((clampedSuggestion + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionIndex((clampedSuggestion - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const suggestion = suggestions[clampedSuggestion];
      if (suggestion) {
        insertSuggestion(suggestion.cardName);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setToken(null);
    }
  };

  const trimmedName = name.trim();

  const handleSubmit = () => {
    if (!linksValid || trimmedName === "") {
      return;
    }
    const trimmed = draft.trim();
    const patch: DeckMetaPatch = {};
    if (trimmedName !== currentName) {
      patch.name = trimmedName;
    }
    if (trimmed !== (currentDescription ?? "")) {
      patch.description = trimmed === "" ? null : trimmed;
    }
    const nextLinks = toLinks(filledLinks);
    if (JSON.stringify(nextLinks) !== JSON.stringify(currentLinks)) {
      patch.links = nextLinks;
    }
    if (Object.keys(patch).length > 0) {
      update(patch);
    }
    onOpenChange(false);
  };

  const preview = (
    <div className="bg-card min-h-48 overflow-y-auto rounded-md border p-3 lg:max-h-96">
      {draft.trim() === "" ? (
        <p className="text-muted-foreground text-sm">{m.decks_dialog_details_preview_empty()}</p>
      ) : (
        <MarkdownText
          text={draft}
          headings
          className="text-muted-foreground text-sm"
          renderCardLink={(_name, children) => (
            <span className={PREVIEW_CARD_LINK_CLASS}>{children}</span>
          )}
        />
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setName(currentName);
          setDraft(currentDescription ?? "");
          setLinks(toDrafts(currentLinks));
          setPane("write");
          setToken(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{m.decks_dialog_details_title()}</DialogTitle>
            <DialogDescription>
              <ParaglideMessage
                message={m.decks_dialog_details_description}
                markup={{ code: ({ children }) => <Code className="mx-1">{children}</Code> }}
              />
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-details-name">{m.common_name()}</Label>
            <Input
              id="deck-details-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: dialog input should grab focus
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="deck-details-description">
              {m.decks_dialog_details_description_label()}
            </Label>
            <ToggleGroup
              variant="outline"
              spacing={0}
              size="sm"
              value={[pane]}
              onValueChange={([next]) => {
                if (next === "write" || next === "preview") {
                  setPane(next);
                }
              }}
              aria-label={m.decks_dialog_details_pane_label()}
              className="lg:hidden"
            >
              <ToggleGroupItem value="write">{m.decks_dialog_details_pane_write()}</ToggleGroupItem>
              <ToggleGroupItem value="preview">
                {m.decks_dialog_details_pane_preview()}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn("relative", pane === "preview" && "max-lg:hidden")}>
              <Textarea
                id="deck-details-description"
                ref={textareaRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  refreshToken(event.target);
                }}
                onSelect={(event) => refreshToken(event.currentTarget)}
                onKeyDown={handleTextareaKeyDown}
                onBlur={() => setToken(null)}
                maxLength={DESCRIPTION_MAX}
                rows={14}
                className="lg:max-h-96"
                placeholder={m.decks_dialog_details_description_placeholder()}
              />
              {suggestions.length > 0 && (
                <div
                  role="listbox"
                  aria-label={m.decks_dialog_details_suggestions_label()}
                  className="bg-popover absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border shadow-md"
                >
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={suggestion.cardId}
                      type="button"
                      role="option"
                      aria-selected={index === clampedSuggestion}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start rounded-none font-normal",
                        index === clampedSuggestion && "bg-muted",
                      )}
                      // Mousedown so the click wins against the textarea blur
                      // closing the popup.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertSuggestion(suggestion.cardName);
                      }}
                    >
                      {suggestion.cardName}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-muted-foreground text-2xs mt-1 text-right tabular-nums">
                {draft.length} / {DESCRIPTION_MAX}
              </p>
            </div>
            <div className={cn(pane === "write" && "max-lg:hidden")}>{preview}</div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{m.decks_dialog_details_links_label()}</Label>
            <LinkRowsField
              links={links}
              onChange={setLinks}
              max={MAX_DECK_LINKS}
              isValidUrl={isAllowedLinkUrl}
              urlPlaceholder="https://youtube.com/watch?v=…"
            />
            {!linksValid && <FieldError className="text-xs">{allowedHostsHint()}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!linksValid || trimmedName === ""}>
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
