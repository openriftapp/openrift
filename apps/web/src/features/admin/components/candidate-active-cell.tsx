import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import { fixTypography } from "@openrift/shared/fix-typography";
import { ArrowRightLeftIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { SELECT_NONE, SimpleSelect } from "@/components/ui/simple-select";
import {
  ImageUrlCell,
  renderLabeledValue,
} from "@/features/admin/components/candidate-cell-display";
import {
  MultiSelectCell,
  SuggestionCombobox,
  TagChipCell,
} from "@/features/admin/components/candidate-cell-editors";
import type { FieldDef } from "@/features/admin/components/candidate-field-defs";
import {
  dropdownOptions,
  hasDropdown,
  candidateValueText,
  isMultiSelect,
  resolveLabel,
} from "@/features/admin/components/candidate-field-defs";
import { CardTextExpandDialog } from "@/features/admin/components/card-text-expand-dialog";
import { parseIntegerInput } from "@/features/admin/lib/integer-input";
import { CardText } from "@/features/cards/components/card-text";
import { cn } from "@/lib/utils";

export function CandidateActiveCell<TKey extends string>({
  field,
  activeRow,
  activeValue,
  isRequired,
  editingField,
  setEditingField,
  onActiveChange,
  activeImageUrl,
  renderContent,
  costKeywords,
}: {
  field: FieldDef<TKey>;
  activeRow: Record<string, unknown> | null;
  activeValue: unknown;
  isRequired: boolean;
  editingField: string | null;
  setEditingField: (key: string | null) => void;
  onActiveChange?: (field: TKey, value: unknown | null) => void;
  activeImageUrl?: string | null;
  renderContent?: (field: FieldDef<TKey>) => ReactNode | undefined;
  costKeywords: readonly string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const content = renderContent?.(field);

  const isMissing = isRequired && !hasFieldValue(activeValue);
  const canReverseActive =
    field.array === true && Array.isArray(activeValue) && activeValue.length > 1;

  function commitEdit(raw: string) {
    setEditingField(null);
    if (!onActiveChange) {
      return;
    }
    const trimmed = raw.trim();
    if (field.array) {
      const items = trimmed
        ? trimmed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      onActiveChange(field.key, items.length > 0 ? items : null);
      return;
    }
    if (field.type === "number") {
      const parsed = parseIntegerInput(trimmed);
      if (parsed !== undefined) {
        onActiveChange(field.key, parsed);
      }
      return;
    }
    onActiveChange(field.key, trimmed || null);
  }

  return (
    <td
      className={cn(
        "group/active bg-success-soft text-success relative border-l px-3 py-1.5 align-top break-words",
        field.multiline && "whitespace-pre-wrap",
        field.readOnly && "bg-muted/30",
        isMissing && "bg-destructive-soft text-destructive",
        onActiveChange &&
          !field.readOnly &&
          (field.type === "boolean" || hasDropdown(field)
            ? "hover:bg-muted/50 cursor-pointer"
            : "hover:bg-muted/50 cursor-text"),
      )}
      onClick={() => {
        if (!onActiveChange || field.readOnly || field.richText || editingField === field.key) {
          return;
        }
        if (field.type === "boolean") {
          onActiveChange(field.key, activeValue === null ? false : !activeValue);
          return;
        }
        if (hasDropdown(field)) {
          setEditingField(field.key);
          return;
        }
        setEditingField(field.key);
        requestAnimationFrame(() => {
          if (field.multiline) {
            textareaRef.current?.focus();
          } else {
            inputRef.current?.focus();
          }
        });
      }}
    >
      {content ??
        (field.richText ? (
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1 break-words whitespace-normal">
              {hasFieldValue(activeValue) ? (
                field.richTextVariant === "flavor" ? (
                  // Flavor is a plain span, not CardText; whitespace-pre-line keeps its line breaks.
                  <span className="text-muted-foreground/80 whitespace-pre-line italic">
                    {String(activeValue)}
                  </span>
                ) : (
                  <CardText text={String(activeValue)} interactive={false} />
                )
              ) : (
                <span className={isMissing ? "text-destructive" : "text-muted-foreground"}>
                  {isMissing ? "required" : "—"}
                </span>
              )}
            </div>
            {onActiveChange && !field.readOnly && (
              <CardTextExpandDialog
                label={field.label}
                value={hasFieldValue(activeValue) ? String(activeValue) : ""}
                imageUrl={activeImageUrl}
                variant={field.richTextVariant}
                reformat={(value) =>
                  field.richTextVariant === "flavor"
                    ? fixTypography(value, { italicParens: false, keywordGlyphs: false })
                    : fixTypography(value, { costKeywords })
                }
                onSave={(next) => onActiveChange(field.key, next.trim() || null)}
                triggerClassName="text-muted-foreground shrink-0"
              />
            )}
          </div>
        ) : editingField === field.key && isMultiSelect(field) ? (
          <MultiSelectCell
            label={field.label}
            options={dropdownOptions(field)}
            value={Array.isArray(activeValue) ? (activeValue as string[]) : []}
            onCommit={(next) => onActiveChange?.(field.key, next)}
            onClose={() => setEditingField(null)}
          />
        ) : editingField === field.key && hasDropdown(field) ? (
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keeps trigger clicks from reaching the row's cell selection, renders no box
          <span className="contents" onClick={(e) => e.stopPropagation()}>
            <SimpleSelect
              items={[
                { value: SELECT_NONE, label: "— clear —" },
                ...(field.labeledOptions ??
                  field.options?.map((opt) => ({ value: opt, label: opt })) ??
                  []),
              ]}
              value={hasFieldValue(activeValue) ? String(activeValue) : null}
              onChange={(v) => {
                setEditingField(null);
                onActiveChange?.(field.key, v === SELECT_NONE ? null : v);
              }}
              defaultOpen
              onOpenChange={(open) => {
                if (!open) {
                  setEditingField(null);
                }
              }}
              label={field.label}
              placeholder="— select —"
              className="w-full gap-1 rounded-md border-none px-1 text-sm shadow-none"
            />
          </span>
        ) : editingField === field.key && field.suggestions ? (
          <SuggestionCombobox
            suggestions={field.suggestions}
            defaultValue={hasFieldValue(activeValue) ? String(activeValue) : ""}
            onCommit={(value) => commitEdit(value)}
            onCancel={() => setEditingField(null)}
          />
        ) : editingField === field.key && field.multiline ? (
          <textarea
            ref={textareaRef}
            aria-label={field.label}
            defaultValue={hasFieldValue(activeValue) ? String(activeValue) : ""}
            rows={4}
            className="border-primary w-full resize-y rounded-md border bg-transparent p-1 text-sm outline-none"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: inline editor should grab focus immediately
            autoFocus
            onBlur={(e) => commitEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditingField(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : editingField === field.key && field.array && !hasDropdown(field) ? (
          <TagChipCell
            value={Array.isArray(activeValue) ? (activeValue as string[]) : []}
            placeholder={`Add ${field.label.toLowerCase()}`}
            onChange={(next) => onActiveChange?.(field.key, next.length > 0 ? next : null)}
            onDone={() => setEditingField(null)}
          />
        ) : editingField === field.key ? (
          <input
            ref={inputRef}
            type="text"
            aria-label={field.label}
            inputMode={field.type === "number" ? "numeric" : undefined}
            defaultValue={
              hasFieldValue(activeValue)
                ? Array.isArray(activeValue)
                  ? activeValue.join(", ")
                  : String(activeValue)
                : ""
            }
            className="border-primary w-full border-b bg-transparent text-sm outline-none"
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: inline editor should grab focus immediately
            autoFocus
            onBlur={(e) => commitEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitEdit(e.currentTarget.value);
              } else if (e.key === "Escape") {
                setEditingField(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : field.key === "imageUrl" && typeof activeValue === "string" ? (
          <ImageUrlCell url={activeValue} alt="On the site" />
        ) : (
          <span
            className={cn(
              isMissing ? "text-destructive" : "text-muted-foreground",
              (hasDropdown(field) || field.array) && "block truncate",
            )}
            title={
              (hasDropdown(field) || field.array) && activeRow && hasFieldValue(activeValue)
                ? resolveLabel(field, activeValue)
                : undefined
            }
          >
            {activeRow
              ? field.labeledOptions
                ? renderLabeledValue(field, activeValue)
                : candidateValueText(
                    activeValue,
                    field.suffixKey ? activeRow[field.suffixKey] : undefined,
                  )
              : isMissing
                ? "required"
                : "—"}
          </span>
        ))}
      {onActiveChange &&
        !field.readOnly &&
        !field.richText &&
        editingField !== field.key &&
        (canReverseActive || (!isRequired && hasFieldValue(activeValue))) && (
          <div className="absolute top-1 right-1 flex gap-0.5 md:hidden md:group-hover/active:flex">
            {canReverseActive && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Reverse ${field.label} order`}
                title="Reverse order"
                className="text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onActiveChange(field.key, (activeValue as unknown[]).toReversed());
                }}
              >
                <ArrowRightLeftIcon className="size-3" />
              </Button>
            )}
            {!isRequired && hasFieldValue(activeValue) && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Clear ${field.label}`}
                className="text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onActiveChange(field.key, null);
                }}
              >
                <XIcon className="size-3" />
              </Button>
            )}
          </div>
        )}
    </td>
  );
}
