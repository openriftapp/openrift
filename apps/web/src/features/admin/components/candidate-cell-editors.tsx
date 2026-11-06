import { useEffect, useRef, useState } from "react";

import { ComboboxPicker, summarizePickerSelection } from "@/components/combobox-picker";
import { Pressable } from "@/components/ui/pressable";
import { ChipInput } from "@/features/contribute/components/form-fields";
import { cn } from "@/lib/utils";

export function SuggestionCombobox({
  suggestions,
  defaultValue,
  onCommit,
  onCancel,
}: {
  suggestions: readonly string[];
  defaultValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keeps clicks inside the editor from reaching the row's edit handler
    <div
      className="border-primary rounded-md border"
      onClick={(event: React.MouseEvent) => event.stopPropagation()}
    >
      <ComboboxPicker
        trigger="input"
        inline
        aria-label="Value"
        placeholder="Type or select…"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: inline editor should grab focus immediately
        autoFocus
        options={suggestions.map((suggestion) => ({ value: suggestion, label: suggestion }))}
        value={null}
        onChange={(next) => {
          if (next !== null) {
            onCommit(next);
          }
        }}
        query={inputValue}
        onQueryChange={setInputValue}
        onHighlightChange={setHighlighted}
        onKeyDown={(event) => {
          if (event.key === "Enter" && highlighted === null) {
            event.preventDefault();
            onCommit(inputValue);
          }
        }}
        onCancel={onCancel}
        emptyText="No matches"
      />
    </div>
  );
}

export function TagChipCell({
  value,
  placeholder,
  onChange,
  onDone,
}: {
  value: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
  onDone: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    wrapRef.current?.querySelector("input")?.focus();
  }, []);
  return (
    <div
      ref={wrapRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onDone();
        }
      }}
    >
      <ChipInput value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

export function MultiSelectCell({
  label,
  options,
  value,
  onCommit,
  onClose,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onCommit: (next: string[] | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(value);
  const summary = draft.length > 0 ? summarizePickerSelection(options, draft) : "— select —";
  return (
    <ComboboxPicker
      multiple
      open
      onOpenChange={(open) => {
        if (open) {
          return;
        }
        const original = new Set(value);
        const changed = draft.length !== value.length || draft.some((item) => !original.has(item));
        if (changed) {
          onCommit(draft.length > 0 ? draft : null);
        }
        onClose();
      }}
      options={options}
      value={draft}
      onChange={setDraft}
      aria-label={`Edit ${label}`}
      triggerRender={
        <Pressable
          className="flex w-full items-center gap-1 rounded-md text-sm"
          onClick={(event: React.MouseEvent) => event.stopPropagation()}
        />
      }
      triggerLabel={
        <span
          className={cn("min-w-0 flex-1 truncate", draft.length === 0 && "text-muted-foreground")}
          title={draft.length > 0 ? summary : undefined}
        >
          {summary}
        </span>
      }
      searchPlaceholder={`Search ${label.toLowerCase()}…`}
      emptyText="No matches."
      contentClassName="w-max max-w-[90vw]"
    />
  );
}
