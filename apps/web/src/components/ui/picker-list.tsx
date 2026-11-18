import { matchesTextQuery } from "@openrift/shared/search-fold";
import { Command as CommandPrimitive } from "cmdk";
import type { KeyboardEvent, ReactNode, Ref } from "react";
import { useLayoutEffect, useRef } from "react";

import { Command, CommandGroup, CommandInput, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface PickerListProps {
  header?: ReactNode;
  /** When set, renders a type-to-filter input above the list. Rows are matched against their `keywords` prop only (never `value`, which is usually an opaque id), so every `PickerRow` must pass `keywords` for filtering to find it. */
  searchPlaceholder?: string;
  /** Currently highlighted row id. Always pass a string (use "" for "no initial choice"); cmdk skips its controlled-state sync if `value` is undefined. */
  highlightedId: string;
  onHighlightChange: (value: string) => void;
  /** Custom keyboard shortcuts (e.g. `-`, `+`). cmdk already handles arrows / Home / End / Enter. */
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>, highlightedId: string) => void;
  listClassName?: string;
  children: ReactNode;
}

const PICKER_ROW_SELECTED =
  "bg-primary/10 text-primary data-selected:bg-primary/10 data-selected:text-primary data-selected:**:text-primary";

/**
 * cmdk filter that matches the query against row `keywords` only. Row `value`s
 * are opaque ids here, so cmdk's default value matching would produce phantom
 * hits. Uniform scores (1/0) keep the rows in their original order instead of
 * cmdk's score-based reordering.
 *
 * @returns 1 when every query word appears in some keyword (or the query is empty), else 0.
 */
function keywordFilter(_value: string, search: string, keywords?: string[]): number {
  if (!search.trim()) {
    return 1;
  }
  return keywords !== undefined && matchesTextQuery(search, keywords) ? 1 : 0;
}

/**
 * Keyboard-navigable list intended to live inside a popover. Wraps cmdk's
 * Command primitive so arrow keys, Enter, hover-sync, and a11y semantics are
 * inherited; exposes a hook for custom shortcut keys that act on the
 * currently-highlighted row.
 *
 * @returns A focusable Command root + CommandList containing the children
 *   (typically `PickerRow`s).
 */
export function PickerList({
  header,
  searchPlaceholder,
  highlightedId,
  onHighlightChange,
  onKeyDown,
  listClassName,
  children,
}: PickerListProps) {
  // cmdk's keydown handler only fires when focus lives inside the Command, so we
  // move focus to the root on mount — or to the filter input when search is
  // enabled, so typing starts immediately. NOT via the `autoFocus` DOM attribute:
  // React honors it by calling `.focus()` with no options, which scrolls the
  // element into view. When the picker lives in a popover anchored to a tile in
  // a window-virtualized grid, that scroll jumps the whole grid and detaches the
  // popover from its anchor. Focus explicitly with `preventScroll` instead.
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollPendingRef = useRef(true);
  useLayoutEffect(() => {
    const root = rootRef.current;
    // In a bottom drawer, focusing the input opens the phone keyboard over the list.
    const inDrawer = root?.closest("[data-slot=drawer-content]") !== null;
    const input = inDrawer ? null : root?.querySelector<HTMLElement>("[cmdk-input]");
    (input ?? root)?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!scrollPendingRef.current || !list || !highlightedId) {
      return;
    }
    scrollPendingRef.current = false;
    const row = list.querySelector<HTMLElement>(
      `[data-picker-value="${CSS.escape(highlightedId)}"]`,
    );
    if (row) {
      scrollRowWithinList(list, row);
    }
  }, [highlightedId]);

  const searchable = searchPlaceholder !== undefined;
  return (
    <Command
      ref={rootRef}
      loop
      // With a filter input, focus lives in the input; keep the root out of the
      // tab order so dialog initial-focus logic lands on the input instead.
      tabIndex={searchable ? -1 : 0}
      value={highlightedId}
      onValueChange={onHighlightChange}
      filter={searchable ? keywordFilter : undefined}
      onKeyDown={(event) => {
        scrollPendingRef.current = true;
        onKeyDown?.(event, highlightedId);
      }}
      onPointerMove={() => {
        scrollPendingRef.current = false;
      }}
    >
      {searchable ? <CommandInput placeholder={searchPlaceholder} /> : null}
      {header}
      {/* p-1 stands in for the CommandGroup a plain Command palette wraps its items in: that group
          is where the scaffold's row inset and the 4px break under the filter input come from, and
          rows go straight into the list here. Without it the input pill (inset by Command's p-1 plus
          the input wrapper's own) sits 4px narrower per side than the rows, and its bottom border
          touches the first row. */}
      <CommandList ref={listRef} className={cn("max-h-72 p-1", listClassName)}>
        {children}
      </CommandList>
    </Command>
  );
}

interface PickerRowProps {
  value: string;
  /** Display strings the parent PickerList's filter input matches against (e.g. the row's name). Required for the row to survive filtering when the list is searchable. */
  keywords?: string[];
  /** Called on click and on Enter when this row is highlighted. Omit for rows whose interaction lives in inline controls (e.g. inline +/- buttons). */
  onSelect?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

function skipScrollIntoView(): void {
  // PickerList scrolls the highlighted row itself (scrollRowWithinList).
}

/**
 * cmdk 1.1 keeps the highlighted row, and the heading above a group's first row, visible with a
 * native scrollIntoView that also scrolls the window, and has no option to turn it off.
 */
function muteCmdkScroll(node: HTMLElement | null): void {
  if (node) {
    node.scrollIntoView = skipScrollIntoView;
  }
}

const ROW_SCROLL_MARGIN_PX = 32;

function scrollRowWithinList(list: HTMLElement, row: HTMLElement): void {
  const heading =
    row.parentElement?.firstElementChild === row
      ? row.closest("[cmdk-group]")?.querySelector("[cmdk-group-heading]")
      : null;
  const rowRect = row.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const top = Math.min(
    rowRect.top - ROW_SCROLL_MARGIN_PX,
    heading?.getBoundingClientRect().top ?? Infinity,
  );
  const bottom = rowRect.bottom + ROW_SCROLL_MARGIN_PX;
  if (top < listRect.top) {
    list.scrollTop -= listRect.top - top;
  } else if (bottom > listRect.bottom) {
    list.scrollTop += bottom - listRect.bottom;
  }
}

/**
 * One row in a PickerList. Wraps cmdk's Item primitive directly (not shadcn's
 * `CommandItem`) so the row can contain arbitrary trailing content — counts,
 * inline buttons, etc. — without the auto-rendered CheckIcon stealing layout.
 *
 * @returns A cmdk-tracked row that participates in keyboard nav and hover-sync.
 */
export function PickerRow({
  value,
  keywords,
  onSelect,
  selected = false,
  disabled = false,
  className,
  ref,
  children,
}: PickerRowProps) {
  const setRef = (node: HTMLDivElement | null) => {
    muteCmdkScroll(node);
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <CommandPrimitive.Item
      ref={setRef}
      data-slot="picker-row"
      data-picker-value={value}
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      disabled={disabled}
      data-checked={selected || undefined}
      className={cn(
        "data-selected:bg-muted data-selected:text-foreground flex items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        selected && PICKER_ROW_SELECTED,
        className,
      )}
    >
      {children}
    </CommandPrimitive.Item>
  );
}

/**
 * A labelled band of related rows inside a {@link PickerList}. The heading is a
 * cmdk group heading, so it labels its rows for assistive tech and keyboard nav
 * skips straight over it — unlike a styled `PickerRow`, which arrow keys land on.
 *
 * `p-0` because `PickerList`'s own list already carries the inset that a plain
 * Command palette gets from its group.
 *
 * @returns The group, or nothing when it holds no rows.
 */
export function PickerGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <CommandGroup
      ref={(node: HTMLDivElement | null) =>
        muteCmdkScroll(node?.querySelector<HTMLElement>("[cmdk-group-heading]") ?? null)
      }
      heading={label}
      className={cn(
        "p-0 **:[[cmdk-group-heading]]:px-1.5 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-0.5",
        className,
      )}
    >
      {children}
    </CommandGroup>
  );
}
