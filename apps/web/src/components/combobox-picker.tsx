import { ChevronRightIcon } from "lucide-react";
import type { FocusEvent, KeyboardEvent, ReactElement, ReactNode, Ref } from "react";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ComboboxPickerOption {
  value: string;
  label: string;
  prefix?: ReactNode;
  detail?: ReactNode;
  keywords?: string;
  disabled?: boolean;
  icon?: ReactNode;
  iconAfterLabel?: boolean;
  count?: number;
  muted?: boolean;
  group?: string;
  belowDivider?: boolean;
  indicator?: ReactNode;
  onSelect?: () => void;
}

/** A row below the options that runs a command with the current query, e.g. "Create “x”". */
interface ComboboxPickerAction {
  key: string;
  label: (query: string) => ReactNode;
  onSelect: (query: string) => void;
  visible?: (query: string) => boolean;
  disabled?: boolean;
}

interface ComboboxPickerBaseProps {
  options: readonly ComboboxPickerOption[];
  trigger?: "button" | "input" | "chip" | "menu";
  placeholder?: string;
  triggerLabel?: ReactNode;
  triggerIcon?: ReactNode;
  triggerRender?: ReactElement;
  active?: boolean;
  searchPlaceholder?: string;
  searchable?: boolean | "hidden";
  emptyText: string;
  loading?: boolean;
  loadingText?: string;
  hint?: string;
  filter?: "client" | "none";
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  onHighlightChange?: (value: string | null) => void;
  actions?: readonly ComboboxPickerAction[];
  clearOnSelect?: boolean;
  renderOption?: (option: ComboboxPickerOption) => ReactNode;
  groupLabels?: ReadonlyMap<string, string>;
  selectedOptions?: readonly ComboboxPickerOption[];
  wrapLabels?: boolean;
  containKeys?: boolean;
  freeText?: boolean;
  createLabel?: (text: string) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  openOnFocus?: boolean;
  inline?: boolean;
  showChevron?: boolean;
  clearable?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onCancel?: () => void;
  size?: "sm" | "default";
  className?: string;
  contentClassName?: string;
  listClassName?: string;
  contentRef?: Ref<HTMLDivElement>;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

interface SingleProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
}

interface MultipleProps {
  multiple: true;
  value: readonly string[];
  onChange: (value: string[]) => void;
}

export type ComboboxPickerProps = ComboboxPickerBaseProps & (SingleProps | MultipleProps);

const ACTION_PREFIX = "\u0000action:";
const CREATE_ACTION = "\u0000create";
const TYPED_REASONS = new Set(["input-change", "input-paste", "clear-press"]);

export function matchesPickerQuery(option: ComboboxPickerOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return true;
  }
  const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}

export function summarizePickerSelection(
  options: readonly ComboboxPickerOption[],
  selected: readonly string[],
): string {
  const chosen = new Set(selected);
  const known = options.filter((option) => chosen.has(option.value));
  const knownValues = new Set(known.map((option) => option.value));
  const orphans = selected.filter((value) => !knownValues.has(value));
  return [...known.map((option) => option.label), ...orphans].join(", ");
}

interface RowLead {
  separator: boolean;
  header?: string;
}

function placeRowLeads(
  visible: readonly ComboboxPickerOption[],
  groupLabels: ReadonlyMap<string, string> | undefined,
): Map<string, RowLead> {
  const leads = new Map<string, RowLead>();
  let previous: ComboboxPickerOption | undefined;
  let tierDivided = false;
  for (const option of visible) {
    const group = option.group ?? "";
    const newGroup = previous === undefined || (previous.group ?? "") !== group;
    if (newGroup) {
      tierDivided = false;
      const header = groupLabels?.get(group);
      if (previous !== undefined || header !== undefined) {
        leads.set(option.value, { separator: previous !== undefined, header });
      }
    } else if (option.belowDivider && !tierDivided) {
      leads.set(option.value, { separator: true });
    }
    if (option.belowDivider) {
      tierDivided = true;
    }
    previous = option;
  }
  return leads;
}

export function ComboboxPicker(props: ComboboxPickerProps) {
  const {
    options,
    trigger = "button",
    placeholder,
    triggerLabel,
    triggerIcon,
    triggerRender,
    active,
    searchPlaceholder,
    searchable = true,
    emptyText,
    loading = false,
    loadingText,
    hint,
    filter = "client",
    actions = [],
    clearOnSelect = false,
    renderOption,
    groupLabels,
    selectedOptions = [],
    wrapLabels = false,
    containKeys = false,
    createLabel,
    openOnFocus = false,
    inline = false,
    showChevron = true,
    clearable = false,
    size = "default",
    className,
    contentClassName,
    listClassName,
    contentRef,
    disabled,
    autoFocus,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  } = props;
  const byValue = new Map(
    [...selectedOptions, ...options].map((option) => [option.value, option] as const),
  );
  const labelFor = (value: string) => byValue.get(value)?.label ?? value;
  const singleValue = props.multiple ? null : props.value;
  const freeText = props.freeText === true && !props.multiple && trigger === "input";

  // null: untouched, so a single `input` picker shows the selected label.
  const [localQuery, setLocalQuery] = useState<string | null>(props.defaultQuery ?? null);
  const shownSelection = trigger === "input" && singleValue !== null ? labelFor(singleValue) : "";
  const query = props.query ?? (freeText ? (singleValue ?? "") : (localQuery ?? shownSelection));
  const setQuery = (next: string, reason?: string) => {
    if (freeText) {
      if (reason !== undefined && TYPED_REASONS.has(reason) && !props.multiple) {
        props.onChange(next === "" ? null : next);
        props.onQueryChange?.(next);
      }
      return;
    }
    setLocalQuery(next);
    props.onQueryChange?.(next);
  };
  const filterQuery = !props.multiple && query !== "" && query === shownSelection ? "" : query;

  const [localOpen, setLocalOpen] = useState(props.defaultOpen ?? false);
  const open = inline || (props.open ?? localOpen);
  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    props.onOpenChange?.(next);
  };

  const typed = query.trim();
  const createAction: ComboboxPickerAction[] =
    freeText && createLabel
      ? [
          {
            key: CREATE_ACTION,
            label: () => createLabel(typed),
            visible: () =>
              typed !== "" &&
              !options.some((option) => option.label.toLowerCase() === typed.toLowerCase()),
            onSelect: () => {
              if (!props.multiple) {
                props.onChange(typed);
              }
            },
          },
        ]
      : [];
  const visibleActions = [...actions, ...createAction].filter((action) =>
    action.visible ? action.visible(query) : query.trim() !== "",
  );
  const selected: readonly string[] = props.multiple
    ? props.value
    : props.value === null || freeText
      ? []
      : [props.value];
  const orphans = selected.filter((value) => !byValue.has(value));
  const items = [
    ...options.map((option) => option.value),
    ...orphans,
    ...visibleActions.map((action) => `${ACTION_PREFIX}${action.key}`),
  ];
  const keeps = (option: ComboboxPickerOption, search: string) =>
    filter === "none" || matchesPickerQuery(option, search);
  const hasLeads = options.some(
    (option) => option.group !== undefined || option.belowDivider === true,
  );
  const rowLeads = hasLeads
    ? placeRowLeads(
        options.filter((option) => keeps(option, filterQuery)),
        groupLabels,
      )
    : new Map<string, RowLead>();

  function runAction(value: string) {
    const action = visibleActions.find((entry) => `${ACTION_PREFIX}${entry.key}` === value);
    action?.onSelect(query);
    if (!freeText) {
      setQuery("");
    }
  }

  function handleSingle(next: string | null) {
    if (props.multiple) {
      return;
    }
    if (next !== null && next.startsWith(ACTION_PREFIX)) {
      runAction(next);
      return;
    }
    const command = next === null ? undefined : byValue.get(next)?.onSelect;
    if (command) {
      command();
      return;
    }
    props.onChange(next);
    if (clearOnSelect && !freeText) {
      setQuery("");
    }
  }

  function handleMultiple(next: string[]) {
    if (!props.multiple) {
      return;
    }
    const action = next.find((value) => value.startsWith(ACTION_PREFIX));
    if (action) {
      runAction(action);
      return;
    }
    const current = props.value;
    const command = next
      .filter((value) => !current.includes(value))
      .map((value) => byValue.get(value)?.onSelect)
      .find((entry) => entry !== undefined);
    if (command) {
      command();
      return;
    }
    props.onChange(next);
  }

  const summary = props.multiple
    ? summarizePickerSelection(options, props.value)
    : props.value === null
      ? ""
      : labelFor(props.value);
  const showHint = hint !== undefined && !loading;

  const list = (
    <>
      {loadingText !== undefined && (
        <span role="status" className="sr-only">
          {loading ? loadingText : ""}
        </span>
      )}
      {loading && (
        <div className="flex flex-col gap-2 p-2" aria-hidden="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {showHint && <p className="text-muted-foreground px-2 py-2 text-sm">{hint}</p>}
      {!loading && !showHint && (
        <ComboboxList className={cn(inline && "max-h-80", listClassName)}>
          {(value: string) => {
            if (value.startsWith(ACTION_PREFIX)) {
              const action = visibleActions.find(
                (entry) => `${ACTION_PREFIX}${entry.key}` === value,
              );
              if (!action) {
                return null;
              }
              const first =
                visibleActions[0] === action &&
                options.some((option) => keeps(option, filterQuery));
              return (
                <Fragment key={value}>
                  {first && <ComboboxSeparator />}
                  <ComboboxItem value={value} disabled={action.disabled}>
                    {action.label(query)}
                  </ComboboxItem>
                </Fragment>
              );
            }
            const option = byValue.get(value) ?? { value, label: value };
            const item = (
              <ComboboxItem
                key={value}
                value={value}
                disabled={option.disabled}
                className={cn(option.muted && "opacity-65")}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <>
                    {option.icon !== undefined && !option.iconAfterLabel && option.icon}
                    {option.prefix !== undefined && (
                      <span className="text-muted-foreground w-9 shrink-0 tabular-nums">
                        {option.prefix}
                      </span>
                    )}
                    <span
                      className={cn(
                        "min-w-0",
                        wrapLabels ? "flex-1 break-words whitespace-normal" : "truncate",
                      )}
                    >
                      {option.label}
                      {option.iconAfterLabel && option.icon}
                      {option.count !== undefined && (
                        <span
                          className={cn(
                            "text-muted-foreground text-2xs ml-1.5 tabular-nums",
                            option.count === 0 && "opacity-50",
                          )}
                        >
                          {option.count}
                        </span>
                      )}
                    </span>
                    {option.detail !== undefined && (
                      <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                        {option.detail}
                      </span>
                    )}
                  </>
                )}
                {option.indicator !== undefined && (
                  <span className="absolute right-2 flex size-4 items-center justify-center">
                    {option.indicator}
                  </span>
                )}
              </ComboboxItem>
            );
            const lead = rowLeads.get(value);
            if (!lead) {
              return item;
            }
            return (
              <Fragment key={value}>
                {lead.separator && <ComboboxSeparator />}
                {lead.header !== undefined && (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">{lead.header}</div>
                )}
                {item}
              </Fragment>
            );
          }}
        </ComboboxList>
      )}
      {!loading && !showHint && searchable !== "hidden" && (
        <ComboboxEmpty className={cn(inline && "flex empty:py-0")}>{emptyText}</ComboboxEmpty>
      )}
    </>
  );

  const rootProps = {
    items,
    inputValue: query,
    onInputValueChange: (next: string, details: { reason: string }) =>
      setQuery(next, details.reason),
    open,
    onOpenChange: (next: boolean) => setOpen(next),
    inline,
    onItemHighlighted: (next: string | undefined) =>
      props.onHighlightChange?.(next === undefined || next.startsWith(ACTION_PREFIX) ? null : next),
    itemToStringLabel: labelFor,
    disabled,
    filter:
      filter === "none"
        ? null
        : (value: string, search: string) =>
            value.startsWith(ACTION_PREFIX) ||
            matchesPickerQuery(byValue.get(value) ?? { value, label: value }, search),
  };

  const content =
    trigger === "input" && inline ? (
      <div ref={contentRef} className={contentClassName}>
        {list}
      </div>
    ) : trigger === "input" ? (
      <ComboboxContent ref={contentRef} className={contentClassName}>
        {list}
      </ComboboxContent>
    ) : (
      <ComboboxContent
        ref={contentRef}
        className={cn("min-w-56", contentClassName)}
        onKeyDown={containKeys ? (event) => event.stopPropagation() : undefined}
      >
        {searchable !== false && (
          <ComboboxInput
            className={searchable === "hidden" ? "sr-only" : undefined}
            placeholder={searchPlaceholder}
            showTrigger={false}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the popup just opened from its trigger; typing goes to its search field
            autoFocus
            onKeyDownCapture={
              containKeys
                ? (event) => {
                    if (event.key === "Home" || event.key === "End") {
                      event.stopPropagation();
                    }
                  }
                : undefined
            }
          />
        )}
        {list}
      </ComboboxContent>
    );

  const triggerAria = {
    id,
    "aria-label": ariaLabelledBy ? undefined : ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  };
  const triggerText = triggerLabel ?? (summary === "" ? placeholder : summary);

  const triggerElement =
    trigger === "input" ? (
      <ComboboxInput
        {...triggerAria}
        placeholder={placeholder}
        disabled={disabled}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opt-in via the autoFocus prop
        autoFocus={autoFocus}
        showTrigger={showChevron && !inline}
        showClear={clearable}
        onFocus={(event) => {
          props.onFocus?.(event);
          if (openOnFocus) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.key === "Escape") {
            props.onCancel?.();
          }
          if (event.defaultPrevented) {
            event.preventBaseUIHandler();
          }
        }}
        className={cn("w-full", size === "sm" && "h-(--control-h-sm)", className)}
      />
    ) : trigger === "chip" ? (
      <ComboboxTrigger
        {...triggerAria}
        className={className}
        render={
          <Badge
            variant={(active ?? summary !== "") ? "default" : "outline"}
            className="cursor-pointer [&>svg]:text-current"
            // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bare render slot; Badge owns all styling; label injected as ComboboxTrigger children
            render={<button type="button" />}
          />
        }
      >
        {triggerText}
      </ComboboxTrigger>
    ) : trigger === "menu" ? (
      <ComboboxTrigger
        {...triggerAria}
        render={
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bespoke menu-item-row trigger; matches DropdownMenu item styling, no primitive covers it yet; label injected as ComboboxTrigger children
          <button
            type="button"
            className={cn(
              "hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground flex w-full cursor-default items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-hidden select-none [&>svg:last-of-type]:hidden",
              className,
            )}
          />
        }
      >
        {triggerLabel ?? (
          <>
            <span className="shrink-0 text-left">{placeholder}</span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-right">
              {summary}
            </span>
          </>
        )}
        <ChevronRightIcon className="ml-auto size-4 shrink-0" />
      </ComboboxTrigger>
    ) : (
      <ComboboxTrigger
        {...triggerAria}
        render={
          triggerRender ?? (
            <Button variant="control" size={size} data-active={active || undefined} />
          )
        }
        className={cn("w-full justify-between", className)}
      >
        {triggerIcon}
        {triggerLabel ?? (
          <span className={cn("min-w-0 truncate", summary === "" && "text-muted-foreground")}>
            {triggerText}
          </span>
        )}
      </ComboboxTrigger>
    );

  if (props.multiple) {
    return (
      <Combobox<string, true>
        {...rootProps}
        multiple
        value={[...props.value]}
        onValueChange={handleMultiple}
      >
        {triggerElement}
        {content}
      </Combobox>
    );
  }
  return (
    <Combobox<string>
      {...rootProps}
      value={freeText ? null : props.value}
      onValueChange={handleSingle}
    >
      {triggerElement}
      {content}
    </Combobox>
  );
}
