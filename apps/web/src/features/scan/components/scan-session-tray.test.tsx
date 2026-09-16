import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { ScanSessionTray } from "@/features/scan/components/scan-session-tray";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { ScanTrayExpandedContext } from "@/features/scan/components/scan-tray-shell";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { printingsByCardId } from "@/features/scan/lib/scan-resolve";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { initKeys } from "@/lib/query-keys";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { stubPrinting } from "@/test/factories";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { stubInitResponse } from "@/test/init-fixtures";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { createStoreResetter } from "@/test/store-helpers";

const english = stubPrinting({ id: "p-en", card: { name: "Yasuo" } });
const german = stubPrinting({
  id: "p-de",
  cardId: english.cardId,
  language: "DE",
  card: { name: "Yasuo" },
});

const resetSession = createStoreResetter(useScanSessionStore);

function renderTray({ compact = false, expanded = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(
    initKeys.all,
    stubInitResponse({
      finishes: [{ slug: "normal", label: "Normal", sortOrder: 0 }],
      languages: [{ slug: "DE", label: "German", sortOrder: 0, color: null }],
    }),
  );
  return render(
    <QueryClientProvider client={client}>
      <ScanTrayExpandedContext value={expanded}>
        <ScanSessionTray
          printingsByCard={printingsByCardId([english, german])}
          collections={[]}
          destination={null}
          adding={false}
          failedCount={0}
          compact={compact}
          resumed={false}
          onAddOne={vi.fn()}
          onRemoveOne={vi.fn()}
          onChangePrinting={vi.fn()}
          onClear={vi.fn()}
          onAddAll={vi.fn()}
        />
      </ScanTrayExpandedContext>
    </QueryClientProvider>,
  );
}

function addButtonFollowsLastRow(): boolean {
  const addButton = screen.getByRole("button", { name: /add 2 cards/iu });
  const lastRow = screen.getAllByRole("listitem").at(-1);
  if (lastRow === undefined) {
    return false;
  }
  return (addButton.compareDocumentPosition(lastRow) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

describe("ScanSessionTray", () => {
  beforeEach(resetSession);
  afterEach(resetSession);

  it("names the language of the printing a row was swapped to", () => {
    useScanSessionStore.getState().add(english);
    useScanSessionStore.getState().move(english.id, german);
    renderTray();

    const button = screen.getByRole("button", { name: /change the printing/iu });
    expect(button).toHaveTextContent("DE");
    expect(button).not.toHaveTextContent("Standard");
  });

  it("keeps the add button above the older rows while the drawer peeks", () => {
    useScanSessionStore.getState().add(english);
    useScanSessionStore.getState().add(german);
    renderTray({ compact: true });

    expect(addButtonFollowsLastRow()).toBe(false);
  });

  it("moves the add button below every row once the drawer is expanded", () => {
    useScanSessionStore.getState().add(english);
    useScanSessionStore.getState().add(german);
    renderTray({ compact: true, expanded: true });

    expect(addButtonFollowsLastRow()).toBe(true);
  });
});
