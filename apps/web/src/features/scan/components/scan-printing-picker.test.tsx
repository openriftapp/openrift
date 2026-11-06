import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

import { ScanPrintingPicker } from "./scan-printing-picker";

const isMobile = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => isMobile.value }));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["init"], {
    enums: {
      cardTypes: [],
      rarities: [],
      domains: [],
      superTypes: [],
      finishes: [
        { slug: "normal", label: "Normal", sortOrder: 0 },
        { slug: "foil", label: "Foil", sortOrder: 1 },
      ],
      artVariants: [{ slug: "normal", label: "Normal", sortOrder: 0 }],
      cardSizes: [{ slug: "standard", label: "Standard", sortOrder: 0 }],
      deckFormats: [],
      deckZones: [],
      formats: [],
      conditions: [],
      graders: [],
      languages: [{ slug: "EN", label: "English", color: "#1d4ed8", sortOrder: 0 }],
    },
    keywords: {},
  });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const normal = stubPrinting({ printingId: "p-normal", finish: "normal", card: { name: "Yasuo" } });
const foil = stubPrinting({
  printingId: "p-foil",
  finish: "foil",
  cardId: normal.cardId,
  card: { name: "Yasuo" },
});

describe("ScanPrintingPicker", () => {
  afterEach(() => {
    isMobile.value = false;
  });

  it("marks the printing the row already sits on", () => {
    render(
      <ScanPrintingPicker
        request={{
          artKey: "",
          label: "Yasuo",
          candidates: [normal, foil],
          currentId: "p-normal",
        }}
        onPick={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    const marked = document.querySelectorAll("[aria-current]");
    expect(marked).toHaveLength(1);
    expect(marked[0]!.textContent).toContain("Current");
    expect(marked[0]!.textContent).toContain(normal.shortCode);
  });

  it("marks nothing when the picker is resolving a fresh scan", () => {
    render(
      <ScanPrintingPicker
        request={{ artKey: "", label: "Yasuo", candidates: [normal, foil] }}
        onPick={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });

  it.each([false, true])("picks a printing (mobile: %s)", async (mobile) => {
    isMobile.value = mobile;
    const onPick = vi.fn();
    render(
      <ScanPrintingPicker
        request={{ artKey: "", label: "Yasuo", candidates: [normal, foil] }}
        onPick={onPick}
        onDismiss={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    expect(document.querySelector("[data-slot=drawer-popup]") !== null).toBe(mobile);
    const rows = screen
      .getAllByRole("button")
      .filter((row) => row.textContent?.includes(foil.shortCode));
    await userEvent.click(rows.at(-1)!);
    expect(onPick).toHaveBeenCalledWith(foil);
  });
});
