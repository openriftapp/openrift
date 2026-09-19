import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";

export type SignetTone = "art" | "surface" | "success";

/** `art` is drawn on the card image, `surface` on a themed background. */
const TONE = {
  art: {
    plateEmpty: "fill-black/25",
    plate: "fill-black/70",
    rimEmpty: "stroke-white/70",
    rim: "stroke-gilt",
    echo: "stroke-gilt/55",
    check: "stroke-gilt",
  },
  surface: {
    plateEmpty: "fill-transparent",
    plate: "fill-transparent",
    rimEmpty: "stroke-muted-foreground/60",
    rim: "stroke-border-accent",
    echo: "stroke-border-accent/55",
    check: "stroke-border-accent",
  },
  success: {
    plateEmpty: "fill-black/25",
    plate: "fill-black/70",
    rimEmpty: "stroke-white/70",
    rim: "stroke-success",
    echo: "stroke-success/55",
    check: "stroke-success",
  },
} satisfies Record<SignetTone, Record<string, string>>;

const MARK_BOX =
  "absolute top-1/2 left-1/2 z-30 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full";
const MARK_STRUCK = "w-[clamp(1.75rem,38%,4.5rem)]";
const MARK_EMPTY = "w-[clamp(1.25rem,26%,3rem)]";

interface SignetGlyphProps {
  checked?: boolean;
  tone?: SignetTone;
  className?: string;
}

/**
 * The signet: a struck disc with a rim, its echo and a check. Fills its box,
 * so the caller sizes it.
 *
 * @returns The glyph element.
 */
export function SignetGlyph({ checked = false, tone = "art", className }: SignetGlyphProps) {
  const t = TONE[tone];
  return (
    <svg viewBox="0 0 58 58" className={cn("size-full", className)} aria-hidden="true">
      <circle cx="29" cy="29" r="27" className={checked ? t.plate : t.plateEmpty} />
      <circle
        cx="29"
        cy="29"
        r="27"
        className={cn("fill-none", checked ? t.rim : t.rimEmpty)}
        strokeWidth={checked ? 2.5 : 3}
      />
      {checked && (
        <>
          <circle cx="29" cy="29" r="22" className={cn("fill-none", t.echo)} strokeWidth="1" />
          <path
            d="M18 29.5 25.5 37 40 20.5"
            className={cn("fill-none", t.check)}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

interface SelectionMarkProps {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  tone?: SignetTone;
  className?: string;
}

/**
 * The signet struck across a card image. Absolutely positioned, so the image
 * box must be the nearest positioned ancestor; it sizes itself against that box.
 *
 * @returns The mark element.
 */
export function SelectionMark({
  label,
  checked,
  onCheckedChange,
  tone = "art",
  className,
}: SelectionMarkProps) {
  return (
    <CheckboxPrimitive.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        MARK_BOX,
        "focus-visible:ring-ring cursor-pointer transition-[width] duration-150 outline-none focus-visible:ring-2 motion-reduce:transition-none",
        checked ? MARK_STRUCK : MARK_EMPTY,
        className,
      )}
    >
      <SignetGlyph checked={checked} tone={tone} />
    </CheckboxPrimitive.Root>
  );
}

/** The same mark at control size, for a table row. */
export function SelectionRowMark({
  label,
  checked,
  onCheckedChange,
  className,
}: SelectionMarkProps) {
  return (
    <CheckboxPrimitive.Root
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "focus-visible:ring-ring size-5 shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2",
        className,
      )}
    >
      <SignetGlyph checked={checked} tone="surface" />
    </CheckboxPrimitive.Root>
  );
}

/**
 * The struck signet as a stamp, for a state the whole tile already toggles.
 * Takes no pointer events, so it neither steals the card's hover nor adds a
 * second control.
 *
 * @returns The stamp element.
 */
export function SelectionStamp({
  tone = "art",
  className,
}: {
  tone?: SignetTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(MARK_BOX, MARK_STRUCK, "pointer-events-none", className)}
    >
      <SignetGlyph checked tone={tone} />
    </span>
  );
}
