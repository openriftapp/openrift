import { HelpCircleIcon, ItalicIcon, WandSparklesIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardText } from "@/features/cards/components/card-text";
import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";
import { useFieldLink } from "@/features/contribute/components/contribute-field-focus";
import { useKeywordStyles } from "@/hooks/use-keyword-styles";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const ENERGY_GLYPHS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const RUNE_GLYPHS: { token: string; name: string }[] = [
  { token: "rune_body", name: "Body" },
  { token: "rune_calm", name: "Calm" },
  { token: "rune_chaos", name: "Chaos" },
  { token: "rune_fury", name: "Fury" },
  { token: "rune_mind", name: "Mind" },
  { token: "rune_order", name: "Order" },
  { token: "rune_rainbow", name: "Rainbow" },
];

const UTILITY_GLYPHS: { token: string; name: string }[] = [
  { token: "might", name: "Might" },
  { token: "exhaust", name: "Exhaust" },
];

export function insertAtCaret(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  token: string,
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const before = value.slice(0, start);
  const after = value.slice(end);
  return { value: before + token + after, caret: start + token.length };
}

export function wrapAtCaret(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  const wrapped = prefix + selected + suffix;
  const caret = selected.length === 0 ? start + prefix.length : start + wrapped.length;
  return { value: before + wrapped + after, caret };
}

/**
 * "rules": full card-syntax toolbar and a CardText-rendered preview.
 * "flavor": punctuation-only toolbar and a plain italic preview.
 */
export type CardTextVariant = "rules" | "flavor";

interface CardTextInputProps {
  label: string;
  field?: PlaceholderField;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  variant?: CardTextVariant;
  /** When provided, shows a "Fix" button that reformats the value through this transform. */
  reformat?: (value: string) => string;
}

export function CardTextInput({
  label,
  field,
  value,
  onChange,
  rows = 2,
  placeholder,
  variant = "rules",
  reformat,
}: CardTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const link = useFieldLink(field);

  const insert = (token: string) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const next = insertAtCaret(value, start, end, token);
    onChange(next.value);
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const wrap = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const next = wrapAtCaret(value, start, end, prefix, suffix);
    onChange(next.value);
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div
      {...link.props}
      className={cn(
        "flex flex-col gap-1.5",
        link.active && "ring-primary/40 -m-1 rounded-md p-1 ring-2 transition-shadow",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {variant === "rules" && <SyntaxHelpPopover />}
      </div>
      <SyntaxToolbar
        onInsert={insert}
        onWrap={wrap}
        variant={variant}
        onReformat={reformat ? () => onChange(reformat(value)) : undefined}
      />
      <Textarea
        id={id}
        ref={textareaRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <CardTextPreview text={value} variant={variant} />
    </div>
  );
}

function SyntaxToolbar({
  onInsert,
  onWrap,
  variant,
  onReformat,
}: {
  onInsert: (token: string) => void;
  onWrap: (prefix: string, suffix: string) => void;
  variant: CardTextVariant;
  onReformat?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {variant === "rules" && (
        <ButtonGroup aria-label={m.contribute_text_toolbar_formatting()}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title={m.contribute_text_italic_title()}
            aria-label={m.contribute_text_italic()}
            onClick={() => onWrap("_", "_")}
          >
            <ItalicIcon className="size-4" />
          </Button>
        </ButtonGroup>
      )}
      <ButtonGroup aria-label={m.contribute_text_toolbar_punctuation()}>
        <PunctuationButton
          label={m.contribute_text_quotes()}
          title={m.contribute_text_quotes_title()}
          onClick={() => onWrap("“", "”")}
        >
          “”
        </PunctuationButton>
        <PunctuationButton
          label={m.contribute_text_apostrophe()}
          title={m.contribute_text_apostrophe_title()}
          onClick={() => onInsert("’")}
        >
          ’
        </PunctuationButton>
        <PunctuationButton
          label={m.contribute_text_em_dash()}
          title={m.contribute_text_em_dash_title()}
          onClick={() => onInsert("—")}
        >
          —
        </PunctuationButton>
        <PunctuationButton
          label={m.contribute_text_ellipsis()}
          title={m.contribute_text_ellipsis_title()}
          onClick={() => onInsert("…")}
        >
          …
        </PunctuationButton>
        <PunctuationButton
          label={m.contribute_text_bullet()}
          title={m.contribute_text_bullet_title()}
          onClick={() => onInsert("•")}
        >
          •
        </PunctuationButton>
      </ButtonGroup>
      {onReformat && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          title={m.contribute_text_reformat_title()}
          onClick={onReformat}
        >
          <WandSparklesIcon className="size-3.5" />
          {m.contribute_text_reformat()}
        </Button>
      )}
      {variant === "flavor" ? null : (
        <>
          <ButtonGroup aria-label={m.contribute_text_toolbar_energy()}>
            {ENERGY_GLYPHS.map((n) => (
              <GlyphButton
                key={`energy_${n.toString()}`}
                token={`:rb_energy_${n.toString()}:`}
                label={m.contribute_text_insert_energy({ count: n })}
                onInsert={onInsert}
              >
                <span
                  className="bg-foreground text-background text-2xs inline-flex size-4 items-center justify-center rounded-full font-bold"
                  aria-hidden
                >
                  {n}
                </span>
              </GlyphButton>
            ))}
          </ButtonGroup>
          <ButtonGroup aria-label={m.contribute_text_toolbar_runes()}>
            {RUNE_GLYPHS.map((rune) => (
              <GlyphButton
                key={rune.token}
                token={`:rb_${rune.token}:`}
                label={m.contribute_text_insert_rune({ name: rune.name })}
                onInsert={onInsert}
              >
                <img
                  src={`/images/glyphs/${rune.token.replaceAll("_", "-")}.svg`}
                  alt=""
                  className="size-4"
                />
              </GlyphButton>
            ))}
          </ButtonGroup>
          <ButtonGroup aria-label={m.contribute_text_toolbar_utility()}>
            {UTILITY_GLYPHS.map((g) => (
              <GlyphButton
                key={g.token}
                token={`:rb_${g.token}:`}
                label={m.contribute_text_insert_glyph({ name: g.name })}
                onInsert={onInsert}
              >
                <img
                  src={`/images/glyphs/${g.token.replaceAll("_", "-")}.svg`}
                  alt=""
                  className="size-4 brightness-0 dark:invert"
                />
              </GlyphButton>
            ))}
          </ButtonGroup>
          <KeywordPicker onInsert={onInsert} />
        </>
      )}
    </div>
  );
}

function PunctuationButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      title={title}
      aria-label={label}
      onClick={onClick}
    >
      <span aria-hidden className="text-sm">
        {children}
      </span>
    </Button>
  );
}

function GlyphButton({
  token,
  label,
  onInsert,
  children,
}: {
  token: string;
  label: string;
  onInsert: (token: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      title={m.contribute_text_glyph_title({ label, token })}
      aria-label={label}
      onClick={() => onInsert(token)}
    >
      {children}
    </Button>
  );
}

type KeywordShape = "plain" | "right" | "left" | "both";

const SHAPE_OPTIONS: { id: KeywordShape; sample: (name: string) => string }[] = [
  { id: "plain", sample: (name) => `[${name}]` },
  { id: "right", sample: (name) => `[${name}][>]` },
  { id: "left", sample: (name) => `[>>][${name}]` },
  { id: "both", sample: (name) => `[>>][${name}][>]` },
];

function shapeLabel(shape: KeywordShape): string {
  switch (shape) {
    case "right": {
      return m.contribute_text_shape_right();
    }
    case "left": {
      return m.contribute_text_shape_left();
    }
    case "both": {
      return m.contribute_text_shape_both();
    }
    default: {
      return m.contribute_text_shape_plain();
    }
  }
}

function KeywordPicker({ onInsert }: { onInsert: (token: string) => void }) {
  const styles = useKeywordStyles();
  const [shape, setShape] = useState<KeywordShape>("plain");
  const names = Object.keys(styles).toSorted((a, b) => a.localeCompare(b));
  const tokenFor = (name: string) =>
    SHAPE_OPTIONS.find((option) => option.id === shape)?.sample(name) ?? `[${name}]`;
  return (
    <Combobox<string, false>
      items={names}
      value={null}
      onValueChange={(name) => {
        if (name) {
          onInsert(tokenFor(name));
        }
      }}
      itemToStringLabel={(name) => name}
    >
      <ComboboxTrigger render={<Button variant="outline" size="sm" />}>
        {m.contribute_text_keyword()}
      </ComboboxTrigger>
      <ComboboxContent className="w-72">
        <div className="flex flex-col gap-1.5 p-1">
          <span className="text-muted-foreground px-1 text-xs">{m.contribute_text_shape()}</span>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[shape]}
            onValueChange={([next]) => {
              if (next === "plain" || next === "right" || next === "left" || next === "both") {
                setShape(next);
              }
            }}
            aria-label={m.contribute_text_shape_aria()}
          >
            {SHAPE_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.id} value={option.id} aria-label={shapeLabel(option.id)}>
                <CardText text={option.sample("Tag")} interactive={false} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <ComboboxInput placeholder={m.contribute_text_keyword_search()} showTrigger={false} />
        <ComboboxEmpty>{m.contribute_no_matches()}</ComboboxEmpty>
        <ComboboxList>
          {(name: string) => (
            <ComboboxItem key={name} value={name}>
              <CardText text={tokenFor(name)} interactive={false} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function SyntaxHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="sm" />}
        aria-label={m.contribute_text_syntax_aria()}
      >
        <HelpCircleIcon className="size-3.5" />
        {m.contribute_text_syntax()}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="font-medium">{m.contribute_text_syntax_title()}</p>
        <ul className="text-muted-foreground flex flex-col gap-1.5">
          <li>
            <code className="text-foreground">[Keyword]</code>{" "}
            {m.contribute_text_syntax_keyword_intro()}
            <code className="text-foreground">[&gt;&gt;][Keyword]</code>
            {m.contribute_text_syntax_keyword_right()}
            <code className="text-foreground">[Keyword][&gt;]</code>
            {m.contribute_text_syntax_keyword_both()}
          </li>
          <li>
            <code className="text-foreground">:rb_energy_2:</code>,{" "}
            <code className="text-foreground">:rb_rune_fury:</code>,{" "}
            <code className="text-foreground">:rb_might:</code> {m.contribute_text_syntax_glyphs()}
          </li>
          <li>
            <code className="text-foreground">(reminder text)</code>{" "}
            {m.contribute_text_syntax_reminder()}
          </li>
          <li>
            <code className="text-foreground">_emphasis_</code>{" "}
            {m.contribute_text_syntax_emphasis()}
          </li>
          <li>{m.contribute_text_syntax_newline()}</li>
        </ul>
        <p className="text-muted-foreground">
          {m.contribute_text_syntax_example()}{" "}
          <code className="text-foreground">
            [Equip :rb_energy_1: :rb_rune_mind:] (Attach this to a unit you control.)
          </code>
        </p>
      </PopoverContent>
    </Popover>
  );
}

function CardTextPreview({ text, variant }: { text: string; variant: CardTextVariant }) {
  const trimmed = text.trim();
  if (!trimmed) {
    return (
      <p className="text-muted-foreground border-input rounded-md border border-dashed px-2.5 py-1.5">
        {m.contribute_text_preview_empty()}
      </p>
    );
  }
  return (
    <div className="border-input bg-muted/30 text-foreground rounded-md border px-2.5 py-1.5 text-sm">
      {variant === "flavor" ? (
        <p className="text-muted-foreground/80 whitespace-pre-wrap italic">{text}</p>
      ) : (
        <CardText text={text} interactive={false} />
      )}
    </div>
  );
}
