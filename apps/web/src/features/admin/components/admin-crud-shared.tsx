import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminInstant } from "@/features/admin/components/admin-instant";
import type {
  AdminCellSlotProps,
  AdminDraftSlotProps,
} from "@/features/admin/components/admin-table";
import { isValidSlug } from "@/features/admin/lib/admin-slug";
import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { contrastText } from "@/lib/color";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SlugCell<TRow extends { slug: string }>({ row }: AdminCellSlotProps<TRow>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono text-sm">{row.slug}</span>;
}

export function LabelCell<TRow extends { label: string }>({ row }: AdminCellSlotProps<TRow>) {
  if (!row) {
    return null;
  }
  return <span className="text-sm">{row.label}</span>;
}

export function WellKnownCell<TRow extends { isWellKnown: boolean }>({
  row,
}: AdminCellSlotProps<TRow>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground text-sm">{row.isWellKnown ? "Yes" : "No"}</span>;
}

export function DescriptionCell<TRow extends { description: string | null }>({
  row,
}: AdminCellSlotProps<TRow>) {
  if (!row) {
    return null;
  }
  return (
    <span
      className="text-muted-foreground block max-w-xs truncate"
      title={row.description ?? undefined}
    >
      {row.description ?? EMPTY_VALUE_TEXT}
    </span>
  );
}

export function ColorCell<TRow extends { color: string | null }>({
  row,
}: AdminCellSlotProps<TRow>) {
  if (!row) {
    return null;
  }
  if (!row.color) {
    return <span className="text-muted-foreground">{EMPTY_VALUE_TEXT}</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block size-4 rounded-md border"
        style={{ backgroundColor: row.color }}
      />
      <span className="font-mono text-sm">{row.color}</span>
    </div>
  );
}

export function ColorPreviewCell<TRow extends { label: string; color: string | null }>({
  row,
}: AdminCellSlotProps<TRow>) {
  if (!row) {
    return null;
  }
  return (
    <Badge
      style={row.color ? { backgroundColor: row.color, color: contrastText(row.color) } : undefined}
      variant={row.color ? "default" : "secondary"}
    >
      {row.label}
    </Badge>
  );
}

export function CountCell<TRow>({
  row,
  count,
}: AdminCellSlotProps<TRow> & { count?: (row: TRow) => number }) {
  if (!row || !count) {
    return null;
  }
  const value = count(row);
  return (
    <span className={cn("tabular-nums", value === 0 && "text-muted-foreground")}>
      {formatCount(value)}
    </span>
  );
}

export function InstantCell<TRow>({
  row,
  at,
  relative,
  seconds,
}: AdminCellSlotProps<TRow> & {
  at?: (row: TRow) => Date | string | null;
  relative?: boolean;
  seconds?: boolean;
}) {
  if (!row || !at) {
    return null;
  }
  return (
    <AdminInstant
      at={at(row)}
      relative={relative}
      seconds={seconds}
      className="text-muted-foreground tabular-nums"
    />
  );
}

type StringField<TDraft> = {
  [K in keyof TDraft]: TDraft[K] extends string ? K : never;
}[keyof TDraft];

const LETTER_CASE = {
  lower: (value: string) => value.toLowerCase(),
  upper: (value: string) => value.toUpperCase(),
};

interface DraftTextInputProps<TDraft> extends AdminDraftSlotProps<TDraft> {
  field: StringField<TDraft>;
  placeholder?: string;
  className?: string;
  inputMode?: "numeric" | "url";
  letterCase?: keyof typeof LETTER_CASE;
  "aria-label"?: string;
}

export function DraftTextInput<TDraft>({
  draft,
  setDraft,
  field,
  placeholder,
  className,
  inputMode,
  letterCase,
  "aria-label": ariaLabel,
}: DraftTextInputProps<TDraft>) {
  if (!draft || !setDraft) {
    return null;
  }
  return (
    <Input
      value={String(draft[field])}
      onChange={(event) => {
        const raw = event.target.value;
        const value = letterCase ? LETTER_CASE[letterCase](raw) : raw;
        setDraft((prev) => ({ ...prev, [field]: value }));
      }}
      placeholder={placeholder}
      inputMode={inputMode}
      aria-label={ariaLabel}
      className={cn("h-8", className)}
    />
  );
}

interface SlugAddInputProps<TDraft extends { slug: string }> extends AdminDraftSlotProps<TDraft> {
  placeholder: string;
  width?: string;
}

// Every taxonomy slug is kebab-case, so typing is lowercased as it goes in.
export function SlugAddInput<TDraft extends { slug: string }>({
  placeholder,
  width = "w-40",
  ...slot
}: SlugAddInputProps<TDraft>) {
  return (
    <DraftTextInput<TDraft>
      {...slot}
      field={"slug" as StringField<TDraft>}
      placeholder={placeholder}
      letterCase="lower"
      className={cn("font-mono", width)}
    />
  );
}

interface DescriptionInputProps<
  TDraft extends { description: string },
> extends AdminDraftSlotProps<TDraft> {
  placeholder?: string;
}

export function DescriptionInput<TDraft extends { description: string }>({
  placeholder = "Optional description",
  ...slot
}: DescriptionInputProps<TDraft>) {
  return (
    <DraftTextInput<TDraft>
      {...slot}
      field={"description" as StringField<TDraft>}
      placeholder={placeholder}
    />
  );
}

interface ColorInputProps<TDraft extends { color: string }> extends AdminDraftSlotProps<TDraft> {
  placeholder: string;
}

export function ColorInput<TDraft extends { color: string }>({
  placeholder,
  ...slot
}: ColorInputProps<TDraft>) {
  return (
    <DraftTextInput<TDraft>
      {...slot}
      field={"color" as StringField<TDraft>}
      placeholder={placeholder}
      className="w-28 font-mono"
    />
  );
}

export function validateSlugAndLabel(slug: string, label: string, example: string): string | null {
  if (!slug.trim() || !label.trim()) {
    return "Slug and label are required";
  }
  if (!isValidSlug(slug.trim())) {
    return `Slug must be kebab-case (e.g. ${example})`;
  }
  return null;
}
