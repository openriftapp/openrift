import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

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

const yasuo = stubPrinting({ printingId: "p-yasuo", card: { name: "Yasuo", slug: "yasuo" } });
const jinx = stubPrinting({ printingId: "p-jinx", card: { name: "Jinx", slug: "jinx" } });
const swarm = { name: "Bloodscent Swarm", slug: "bloodscent-swarm" };

const resetDisplayStore = createStoreResetter(useDisplayStore);

describe("ScanIdentifySearch", () => {
  afterEach(resetDisplayStore);

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

  it("lists only printings in the viewer's languages", async () => {
    useDisplayStore.setState({ languages: ["EN"] });
    const english = stubPrinting({ printingId: "p-en", cardId: "c-swarm", card: swarm });
    const chinese = stubPrinting({
      printingId: "p-zh",
      cardId: "c-swarm",
      language: "ZH",
      card: swarm,
    });
    render(<ScanIdentifySearch allPrintings={[english, chinese]} onPick={vi.fn()} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.type(screen.getByLabelText("Search the catalog"), "swarm");

    expect(screen.getAllByText("Bloodscent Swarm")).toHaveLength(1);
    expect(screen.queryByText("EN")).not.toBeInTheDocument();
  });

  it("marks each row's language when the viewer reads several", async () => {
    useDisplayStore.setState({ languages: ["EN", "ZH"] });
    const english = stubPrinting({ printingId: "p-en", cardId: "c-swarm", card: swarm });
    const chinese = stubPrinting({
      printingId: "p-zh",
      cardId: "c-swarm",
      language: "ZH",
      card: swarm,
    });
    render(<ScanIdentifySearch allPrintings={[english, chinese]} onPick={vi.fn()} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.type(screen.getByLabelText("Search the catalog"), "swarm");

    expect(screen.getAllByText("Bloodscent Swarm")).toHaveLength(2);
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("ZH")).toBeInTheDocument();
  });

  it("says so when the query matches no card", async () => {
    render(<ScanIdentifySearch allPrintings={[yasuo, jinx]} onPick={vi.fn()} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.type(screen.getByLabelText("Search the catalog"), "zzz");

    expect(screen.getByText("No card matches that.")).toBeInTheDocument();
  });
});
