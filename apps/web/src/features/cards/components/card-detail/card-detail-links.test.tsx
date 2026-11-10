import type * as ReactRouter from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { stubCard, stubPrinting } from "@/test/factories";

const { isAdminMock } = vi.hoisted(() => ({ isAdminMock: vi.fn(() => false) }));

function searchString(search?: Record<string, string | number | undefined>): string {
  const entries = Object.entries(search ?? {}).filter(([, value]) => value !== undefined);
  return entries.length > 0
    ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}`
    : "";
}

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof ReactRouter>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      to,
      params,
      search,
      children,
      ...rest
    }: {
      to: string;
      params?: { cardSlug: string; printingId?: string; printingSlug?: string };
      search?: Record<string, string | number | undefined>;
      children?: ReactNode;
    }) => (
      <a
        {...rest}
        href={`${(params
          ? to
              .replace("$cardSlug", params.cardSlug)
              .replace("$printingId", params.printingId ?? "")
              .replace("{-$printingSlug}", params.printingSlug ?? "")
          : to
        ).replace(/\/$/u, "")}${searchString(search)}`}
      >
        {children}
      </a>
    ),
  };
});

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useIsAdmin: () => ({ data: isAdminMock() }),
}));

import { CardDetailLinks, CardPageButton } from "./card-detail-links";

async function openCorrectionMenu() {
  await userEvent.setup().click(screen.getByRole("button", { name: "Suggest a correction" }));
  await screen.findByRole("menuitem", { name: "Card details" });
}

describe("CardDetailLinks", () => {
  it("links to the card page and offers the card correction form", async () => {
    render(<CardDetailLinks card={stubCard({ slug: "yasuo" })} />);

    expect(screen.getByRole("link", { name: "Open card page" })).toHaveAttribute(
      "href",
      "/cards/yasuo",
    );
    await openCorrectionMenu();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Card details",
    ]);
    expect(screen.getByRole("menuitem", { name: "Card details" })).toHaveAttribute(
      "href",
      "/contribute/card/yasuo",
    );
  });

  it("links the footer card page link to the shown printing", () => {
    render(
      <CardDetailLinks
        card={stubCard({ slug: "yasuo" })}
        printing={stubPrinting({ printingId: "printing-1", card: { slug: "yasuo" } })}
      />,
    );

    expect(screen.getByRole("link", { name: "Open card page" })).toHaveAttribute(
      "href",
      "/cards/yasuo?printingId=printing-1",
    );
  });

  it("omits the footer card page link when the header carries it", () => {
    render(<CardDetailLinks card={stubCard()} hideCardPage />);

    expect(screen.queryByRole("link", { name: "Open card page" })).not.toBeInTheDocument();
  });

  it("offers the printing and image forms for a printing that has an image", async () => {
    render(
      <CardDetailLinks
        card={stubCard({ slug: "yasuo" })}
        printing={stubPrinting({
          printingId: "p1",
          images: [{ imageId: "019d6c25-b081-74b3-a901-64da4ae01dab" }],
          card: { slug: "yasuo" },
        })}
      />,
    );
    await openCorrectionMenu();

    expect(screen.getByRole("menuitem", { name: "Printing details" })).toHaveAttribute(
      "href",
      "/contribute/card/yasuo/printing/p1",
    );
    expect(screen.getByRole("menuitem", { name: "Card image" })).toHaveAttribute(
      "href",
      "/contribute/card/yasuo/printing/p1/image",
    );
  });

  it("leaves the image form to the missing-image notice when the printing has none", async () => {
    render(
      <CardDetailLinks
        card={stubCard({ slug: "yasuo" })}
        printing={stubPrinting({ printingId: "p1", images: [], card: { slug: "yasuo" } })}
      />,
    );
    await openCorrectionMenu();

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Card details",
      "Printing details",
    ]);
  });

  it("hides the admin view from non-admins", () => {
    isAdminMock.mockReturnValue(false);
    render(<CardDetailLinks card={stubCard()} />);

    expect(screen.queryByRole("link", { name: "Admin view" })).not.toBeInTheDocument();
  });

  it("shows the admin view to admins", () => {
    isAdminMock.mockReturnValue(true);
    render(<CardDetailLinks card={stubCard({ slug: "yasuo" })} />);

    expect(screen.getByRole("link", { name: "Admin view" })).toHaveAttribute(
      "href",
      "/admin/cards/yasuo",
    );
  });
});

describe("CardPageButton", () => {
  it("links to the card page of the shown printing", () => {
    render(
      <CardPageButton
        card={stubCard({ slug: "yasuo" })}
        printing={stubPrinting({ printingId: "printing-1", card: { slug: "yasuo" } })}
      />,
    );

    expect(screen.getByRole("link", { name: "Card page" })).toHaveAttribute(
      "href",
      "/cards/yasuo?printingId=printing-1",
    );
  });
});
