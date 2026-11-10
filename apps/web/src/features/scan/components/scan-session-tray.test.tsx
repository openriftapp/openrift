import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
}));

import { ScanSessionTray } from "@/features/scan/components/scan-session-tray";
import { ScanTrayExpandedContext } from "@/features/scan/components/scan-tray-shell";
import { printingsByCardId } from "@/features/scan/lib/scan-resolve";
import { useScanSessionStore } from "@/features/scan/stores/scan-session-store";
import { initKeys } from "@/lib/query-keys";
import { stubPrinting } from "@/test/factories";
import { stubInitResponse } from "@/test/init-fixtures";
import { createStoreResetter } from "@/test/store-helpers";

const english = stubPrinting({ printingId: "p-en", card: { name: "Yasuo" } });
const german = stubPrinting({
  printingId: "p-de",
  cardId: english.cardId,
  language: "DE",
  card: { name: "Yasuo" },
});

const resetSession = createStoreResetter(useScanSessionStore);

function renderTray({
  compact = false,
  expanded = false,
  onSignInToAdd,
}: { compact?: boolean; expanded?: boolean; onSignInToAdd?: () => void } = {}) {
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
          onSignInToAdd={onSignInToAdd}
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
    useScanSessionStore.getState().move(english.printingId, german);
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

  it("asks a signed-out visitor to sign in when they add the scanned cards", () => {
    const onSignInToAdd = vi.fn();
    useScanSessionStore.getState().add(english);
    renderTray({ onSignInToAdd });

    fireEvent.click(screen.getByRole("button", { name: /add 1 card to a collection/iu }));

    expect(onSignInToAdd).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /pick another collection/iu })).toBeNull();
  });

  it("keeps the add button disabled without a destination for a signed-in user", () => {
    useScanSessionStore.getState().add(english);
    renderTray();

    expect(screen.getByRole("button", { name: /add 1 card to a collection/iu })).toBeDisabled();
  });
});
