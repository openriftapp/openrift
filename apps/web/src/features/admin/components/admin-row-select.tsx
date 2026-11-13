import { useStore } from "zustand";

import { Checkbox } from "@/components/ui/checkbox";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import type { RowSelectionStore } from "@/features/admin/stores/row-selection-store";
import { isRowSelected } from "@/features/admin/stores/row-selection-store";

export function RowSelectCheckbox({
  store,
  scope,
  rowKey,
  label,
  className,
}: {
  store: RowSelectionStore;
  scope: string;
  rowKey: string;
  label: string;
  className?: string;
}) {
  const selected = useStore(store, (state) => isRowSelected(state, scope, rowKey));
  const toggle = useStore(store, (state) => state.toggle);
  return (
    <Checkbox
      checked={selected}
      onCheckedChange={(checked) => toggle(scope, rowKey, checked === true)}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      className={className}
    />
  );
}

interface SelectRowCellProps<T> extends AdminCellSlotProps<T> {
  store?: RowSelectionStore;
  scope?: string;
  rowKey?: (row: T) => string;
  rowLabel?: (row: T) => string;
  canSelect?: (row: T) => boolean;
}

function SelectRowCell<T>({
  row,
  store,
  scope,
  rowKey,
  rowLabel,
  canSelect,
}: SelectRowCellProps<T>) {
  if (
    row === undefined ||
    store === undefined ||
    scope === undefined ||
    rowKey === undefined ||
    rowLabel === undefined ||
    (canSelect !== undefined && !canSelect(row))
  ) {
    return null;
  }
  return (
    <RowSelectCheckbox
      store={store}
      scope={scope}
      rowKey={rowKey(row)}
      label={`Select ${rowLabel(row)}`}
    />
  );
}

export function selectColumn<T>(
  store: RowSelectionStore,
  options: {
    scope: string;
    rowKey: (row: T) => string;
    rowLabel: (row: T) => string;
    canSelect?: (row: T) => boolean;
  },
): AdminColumnDef<T> {
  return {
    header: "",
    id: "select",
    width: "w-10",
    cell: (
      <SelectRowCell<T>
        store={store}
        scope={options.scope}
        rowKey={options.rowKey}
        rowLabel={options.rowLabel}
        canSelect={options.canSelect}
      />
    ),
  };
}

export function SelectAllCheckbox({
  store,
  scope,
  keys,
  label,
}: {
  store: RowSelectionStore;
  scope: string;
  keys: readonly string[];
  label: string;
}) {
  const count = useStore(store, (state) => (state.scope === scope ? state.keys.size : 0));
  const setAll = useStore(store, (state) => state.setAll);
  const clear = useStore(store, (state) => state.clear);
  const allPicked = count === keys.length && count > 0;
  return (
    <Checkbox
      checked={allPicked}
      indeterminate={count > 0 && !allPicked}
      onCheckedChange={(checked) => (checked ? setAll(scope, keys) : clear())}
      aria-label={label}
    />
  );
}
