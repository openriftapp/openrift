// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useCardDesignerStore } from "@/features/designer/stores/card-designer-store";
import { stubInitResponse } from "@/test/init-fixtures";
import { createStoreResetter } from "@/test/store-helpers";

import { CardDesignerForm } from "./card-designer-form";

const reset = createStoreResetter(useCardDesignerStore);
afterEach(reset);

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["init"], stubInitResponse());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CardDesignerForm", () => {
  it("offers the frame switch for a card with a printed frame", () => {
    render(<CardDesignerForm />, { wrapper });
    expect(screen.getByRole("switch", { name: /printed card frame/iu })).toBeTruthy();
  });

  it("hides the frame switch when no frame exists for the card", () => {
    render(<CardDesignerForm />, { wrapper });
    act(() => useCardDesignerStore.getState().setCardField("rarity", "epic"));
    expect(screen.queryByRole("switch", { name: /printed card frame/iu })).toBeNull();
  });
});
