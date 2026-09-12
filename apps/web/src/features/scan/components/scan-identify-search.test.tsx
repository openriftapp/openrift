import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

import { ScanIdentifySearch } from "./scan-identify-search";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["init"], {
    enums: {
      cardTypes: [],
      rarities: [],
      domains: [],
      superTypes: [],
      finishes: [{ slug: "normal", label: "Normal", sortOrder: 0 }],
      artVariants: [{ slug: "normal", label: "Normal", sortOrder: 0 }],
      cardSizes: [{ slug: "standard", label: "Standard", sortOrder: 0 }],
      deckFormats: [],
      deckZones: [],
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

const yasuo = stubPrinting({ id: "p-yasuo", card: { name: "Yasuo", slug: "yasuo" } });
const jinx = stubPrinting({ id: "p-jinx", card: { name: "Jinx", slug: "jinx" } });

describe("ScanIdentifySearch", () => {
  it("shows nothing before a query is typed", () => {
    render(<ScanIdentifySearch allPrintings={[yasuo, jinx]} onPick={vi.fn()} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.queryByText("Yasuo")).not.toBeInTheDocument();
    expect(screen.queryByText("No card matches that.")).not.toBeInTheDocument();
  });

  it("picks a printing the scanner never recognised", async () => {
    const onPick = vi.fn();
    render(<ScanIdentifySearch allPrintings={[yasuo, jinx]} onPick={onPick} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.type(screen.getByLabelText("Search the catalog"), "yas");
    await userEvent.click(screen.getByText("Yasuo"));

    expect(onPick).toHaveBeenCalledWith(yasuo);
  });

  it("says so when the query matches no card", async () => {
    render(<ScanIdentifySearch allPrintings={[yasuo, jinx]} onPick={vi.fn()} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.type(screen.getByLabelText("Search the catalog"), "zzz");

    expect(screen.getByText("No card matches that.")).toBeInTheDocument();
  });
});
