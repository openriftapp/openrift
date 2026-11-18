import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { stubCopy } from "@/test/factories";

const copiesCollection = createCollection(
  localOnlyCollectionOptions<CopyResponse>({
    id: "copies:owned-count-hydration-test",
    getKey: (row) => row.id,
    initialData: [
      stubCopy({ id: "copy-1", printingId: "jinx", groupId: null }),
      stubCopy({ id: "copy-2", printingId: "jinx", groupId: null }),
    ],
  }),
);

vi.mock("@/features/collections/lib/copies-collection", () => ({
  getCopiesCollection: () => copiesCollection,
}));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => {},
}));

const { useOwnedCount } = await import("./use-owned-count");

function Probe() {
  const { data } = useOwnedCount(true);
  return <p>{data === undefined ? "no counts" : `jinx: ${data.jinx ?? 0}`}</p>;
}

function page() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Probe />
    </QueryClientProvider>
  );
}

describe("useOwnedCount in a server-rendered component", () => {
  it("matches the server's empty render even when the collection already holds rows", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(page());
    expect(container.textContent).toBe("no counts");
    document.body.append(container);

    const logged: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
    const recoverable: unknown[] = [];
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, page(), {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });

    await waitFor(() => expect(container.textContent).toBe("jinx: 2"));
    consoleError.mockRestore();
    expect(recoverable).toEqual([]);
    expect(logged.join("\n")).not.toMatch(/hydrat/iu);

    root?.unmount();
    container.remove();
  });
});
