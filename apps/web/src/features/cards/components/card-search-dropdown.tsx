import { useDebouncedCallback } from "@tanstack/react-pacer";
import type { ReactNode, RefObject } from "react";
import { useState } from "react";

import type { ComboboxPickerOption } from "@/components/combobox-picker";
import { ComboboxPicker } from "@/components/combobox-picker";
import type { CardSearchResult } from "@/features/cards/lib/card-search-result";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SEARCH_DEBOUNCE_MS = 150;

interface CatalogSearchComboboxProps<T> {
  results: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  onQueryChange: (query: string) => void;
  itemToInputValue?: (item: T) => string;
  renderActivePreview?: (item: T, anchorRef: RefObject<HTMLElement | null>) => ReactNode;
  onRawInputChange?: (value: string) => void;
  initialQuery?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function CatalogSearchCombobox<T>({
  results,
  getKey,
  renderItem,
  onSelect,
  onQueryChange,
  itemToInputValue,
  renderActivePreview,
  onRawInputChange,
  initialQuery,
  id,
  ariaLabel,
  placeholder = m.cards_search_placeholder(),
  emptyMessage = m.cards_search_empty(),
  loading,
  loadingText,
  disabled,
  className,
  autoFocus,
}: CatalogSearchComboboxProps<T>) {
  const [picked, setPicked] = useState<ComboboxPickerOption | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // State, not a ref: React Compiler flags refs passed to functions during
  // render, and the preview only reads `.current` in its own effect.
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  const notifyQueryChange = useDebouncedCallback(onQueryChange, { wait: SEARCH_DEBOUNCE_MS });

  const byKey = new Map(results.map((item) => [getKey(item), item]));
  const options = results.map((item) => ({
    value: getKey(item),
    label: itemToInputValue?.(item) ?? "",
  }));
  const highlightedItem = highlighted === null ? undefined : byKey.get(highlighted);

  return (
    <>
      <ComboboxPicker
        trigger="input"
        filter="none"
        options={options}
        value={picked?.value ?? null}
        selectedOptions={picked ? [picked] : []}
        onChange={(key) => {
          const item = key === null ? undefined : byKey.get(key);
          setPicked(options.find((option) => option.value === key) ?? null);
          if (item !== undefined) {
            onSelect(item);
          }
        }}
        defaultQuery={initialQuery}
        onQueryChange={(value) => {
          onRawInputChange?.(value);
          notifyQueryChange(value);
        }}
        onHighlightChange={setHighlighted}
        renderOption={(option) => {
          const item = byKey.get(option.value);
          return item === undefined ? null : renderItem(item);
        }}
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        emptyText={emptyMessage}
        loading={loading}
        loadingText={loadingText}
        disabled={disabled}
        showChevron={false}
        clearable
        className={cn("w-auto", className)}
        contentClassName="w-max"
        contentRef={setPopupEl}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opt-in via the autoFocus prop; callers pass it intentionally
        autoFocus={autoFocus}
      />
      {highlightedItem !== undefined &&
        renderActivePreview?.(highlightedItem, { current: popupEl })}
    </>
  );
}

function CardSearchRow({ result }: { result: CardSearchResult }) {
  return (
    <>
      {result.leading}
      <span className="min-w-0 truncate font-medium">{result.label}</span>
      {result.adornment}
      {result.sublabel ? (
        <span className="text-muted-foreground shrink-0">{result.sublabel}</span>
      ) : null}
      {result.detail ? (
        <span className="text-muted-foreground ml-auto shrink-0">{result.detail}</span>
      ) : null}
    </>
  );
}

export function CardSearchDropdown<T extends CardSearchResult = CardSearchResult>({
  results,
  onSearch,
  onSelect,
  ...rest
}: Omit<
  CatalogSearchComboboxProps<T>,
  "getKey" | "renderItem" | "onSelect" | "onQueryChange" | "itemToInputValue"
> & {
  onSearch: (query: string) => void;
  onSelect: (id: string, result: T) => void;
}) {
  return (
    <CatalogSearchCombobox<T>
      results={results}
      getKey={(result) => result.id}
      renderItem={(result) => <CardSearchRow result={result} />}
      itemToInputValue={(result) => result.label}
      onQueryChange={onSearch}
      onSelect={(result) => onSelect(result.id, result)}
      {...rest}
    />
  );
}
