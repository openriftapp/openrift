// @vitest-environment jsdom
import type * as ReactRouter from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";
import { rowActionsWrapper } from "@/test/row-actions";

const toastSuccess = vi.fn();

vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof ReactRouter>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      params,
      search,
      ...rest
    }: {
      children?: ReactNode;
      params: { cardSlug: string; printingSlug?: string };
      search?: { printingId?: string };
    }) => (
      <a
        {...rest}
        href={`/cards/${params.cardSlug}${params.printingSlug ? `/${params.printingSlug}` : ""}${search?.printingId ? `?printingId=${search.printingId}` : ""}`}
      >
        {children}
      </a>
    ),
    useRouter: () => ({
      buildLocation: () => ({ href: "/cards/annie-fiery?printingId=printing-1" }),
    }),
  };
});

const { CatalogCardContextMenu } = await import("./catalog-card-context-menu");

const printing = stubPrinting({ printingId: "printing-1", card: { slug: "annie-fiery" } });

async function openMenu() {
  const user = userEvent.setup();
  render(
    <CatalogCardContextMenu printing={printing} canWish={false}>
      <span>Annie tile</span>
    </CatalogCardContextMenu>,
    { wrapper: rowActionsWrapper() },
  );
  await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Annie tile") });
  return user;
}

describe("CatalogCardContextMenu add item", () => {
  async function openWithTarget(addTargetName?: string) {
    const user = userEvent.setup();
    render(
      <CatalogCardContextMenu printing={printing} canWish addTargetName={addTargetName}>
        <span>Annie tile</span>
      </CatalogCardContextMenu>,
      { wrapper: rowActionsWrapper() },
    );
    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Annie tile") });
  }

  it("names the add target", async () => {
    await openWithTarget("Binder");
    expect(await screen.findByRole("menuitem", { name: "Add to Binder" })).toBeInTheDocument();
  });

  it("leaves out the add item without a target", async () => {
    await openWithTarget();
    await screen.findByRole("menuitem", { name: "Add to wishlist…" });
    expect(screen.queryByRole("menuitem", { name: /^Add to (?!wishlist)/u })).toBeNull();
  });
});

describe("CatalogCardContextMenu link items", () => {
  it("opens the shown printing's card page", async () => {
    await openMenu();
    const item = await screen.findByRole("menuitem", { name: "Open card page" });
    expect(item).toHaveAttribute("href", "/cards/annie-fiery?printingId=printing-1");
  });

  it("opens the printing's card page in a new tab", async () => {
    await openMenu();
    const item = await screen.findByRole("menuitem", { name: "Open in new tab" });
    expect(item).toHaveAttribute("href", "/cards/annie-fiery?printingId=printing-1");
    expect(item).toHaveAttribute("target", "_blank");
    expect(item).toHaveAttribute("rel", "noreferrer");
  });

  it("copies the absolute card page URL", async () => {
    const user = await openMenu();
    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Link copied"));
    expect(await navigator.clipboard.readText()).toBe(
      `${globalThis.location.origin}/cards/annie-fiery?printingId=printing-1`,
    );
  });
});
