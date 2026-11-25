import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ remove: vi.fn(), links: [] as unknown[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children?: React.ReactNode }) => {
    captured.links.push(props);
    return <a href="/admin">{children}</a>;
  },
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useDeletePrinting: () => ({ mutateAsync: captured.remove, isPending: false }),
}));

import { PrintingActionsMenu } from "./printing-actions-menu";

const printing = {
  printingId: "printing-1",
  cardSlug: "jinx",
  cardName: "Jinx",
  secondSide: null,
} as unknown as DeskPrintingRow;

async function deletePrinting(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Printing actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  await user.click(await screen.findByRole("button", { name: "Delete" }));
}

describe("PrintingActionsMenu writes", () => {
  beforeEach(() => {
    captured.remove.mockReset().mockResolvedValue(undefined);
    captured.links = [];
  });

  it("deletes directly when no runWrite is given", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(<PrintingActionsMenu printing={printing} invalidates={[]} onDeleted={onDeleted} />);
    await deletePrinting(user);

    expect(captured.remove).toHaveBeenCalledWith("printing-1", { signal: undefined });
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("hands the delete to runWrite, which passes its signal into the mutation", async () => {
    const user = userEvent.setup();
    const { signal } = new AbortController();
    const runWrite = vi.fn((write: (signal?: AbortSignal) => Promise<unknown>) =>
      write(signal).then(() => true),
    );
    render(
      <PrintingActionsMenu
        printing={printing}
        invalidates={[]}
        onDeleted={vi.fn()}
        runWrite={runWrite}
      />,
    );
    await deletePrinting(user);

    expect(runWrite).toHaveBeenCalledOnce();
    expect(captured.remove).toHaveBeenCalledWith("printing-1", { signal });
  });

  it("stays put when runWrite reports the delete failed", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(
      <PrintingActionsMenu
        printing={printing}
        invalidates={[]}
        onDeleted={onDeleted}
        runWrite={() => Promise.resolve(false)}
      />,
    );
    await deletePrinting(user);

    expect(captured.remove).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe("PrintingActionsMenu duplicate link", () => {
  beforeEach(() => {
    captured.links = [];
  });

  async function openMenu(inWorkspace?: boolean) {
    const user = userEvent.setup();
    render(
      <PrintingActionsMenu
        printing={printing}
        invalidates={[]}
        onDeleted={vi.fn()}
        inWorkspace={inWorkspace}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Printing actions" }));
    await screen.findByText("Duplicate printing");
    return captured.links.at(-1);
  }

  it("stays in the workspace when rendered there", async () => {
    expect(await openMenu(true)).toMatchObject({
      to: "/admin/workspace/printings/create",
      search: { card: "jinx", duplicateFrom: "printing-1" },
    });
  });

  it("opens the card's create page elsewhere", async () => {
    expect(await openMenu()).toMatchObject({
      to: "/admin/cards/$cardSlug/printings/create",
      params: { cardSlug: "jinx" },
      search: { duplicateFrom: "printing-1" },
    });
  });
});

describe("PrintingActionsMenu add face", () => {
  it("offers only the second face to an editor who cannot manage the printing", async () => {
    const user = userEvent.setup();
    const onAddFace = vi.fn();
    render(
      <PrintingActionsMenu
        printing={printing}
        invalidates={[]}
        onDeleted={vi.fn()}
        canManage={false}
        onAddFace={onAddFace}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Printing actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add face 2" }));

    expect(onAddFace).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("leaves the item out when no handler is given", async () => {
    const user = userEvent.setup();
    render(<PrintingActionsMenu printing={printing} invalidates={[]} onDeleted={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Printing actions" }));
    await screen.findByRole("menuitem", { name: "Delete" });

    expect(screen.queryByRole("menuitem", { name: "Add face 2" })).not.toBeInTheDocument();
  });
});
