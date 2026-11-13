import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mirrorSelectionStore } from "@/features/admin/stores/row-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

import { SelectAllCheckbox, selectColumn } from "./admin-row-select";
import type { AdminCellSlotProps } from "./admin-table";
import { AdminTable } from "./admin-table";

interface Row {
  id: string;
  name: string;
}

function NameCell({ row }: AdminCellSlotProps<Row>) {
  return row ? <span>{row.name}</span> : null;
}

const rows: Row[] = [
  { id: "a", name: "Jinx" },
  { id: "b", name: "Vi" },
];

function SelectableTable({ scope }: { scope: string }) {
  return (
    <>
      <SelectAllCheckbox
        store={mirrorSelectionStore}
        scope={scope}
        keys={rows.map((row) => row.id)}
        label="Select all"
      />
      <AdminTable
        columns={[
          selectColumn<Row>(mirrorSelectionStore, {
            scope,
            rowKey: (row) => row.id,
            rowLabel: (row) => row.name,
          }),
          { header: "Name", cell: <NameCell /> },
        ]}
        data={rows}
        getRowKey={(row) => row.id}
      />
    </>
  );
}

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(mirrorSelectionStore);
});

afterEach(() => {
  resetStore();
  vi.restoreAllMocks();
});

describe("selectColumn", () => {
  it("keeps a ticked row checked across re-renders without a hook-order error", async () => {
    const consoleError = vi.spyOn(console, "error");
    const { rerender } = render(<SelectableTable scope="page-1" />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Jinx" }));
    rerender(<SelectableTable scope="page-1" />);

    expect(screen.getByRole("checkbox", { name: "Select Jinx" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Vi" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select all" })).not.toBeChecked();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("selects every row from the select-all box", async () => {
    render(<SelectableTable scope="page-1" />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Select all" }));

    expect(screen.getByRole("checkbox", { name: "Select Jinx" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Vi" })).toBeChecked();
  });

  it("drops the ticks when the scope changes", async () => {
    const { rerender } = render(<SelectableTable scope="page-1" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Jinx" }));

    rerender(<SelectableTable scope="page-2" />);

    expect(screen.getByRole("checkbox", { name: "Select Jinx" })).not.toBeChecked();
  });
});
