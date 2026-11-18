import { act } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useDisplayStore } from "./display-store";

function Probe() {
  const paneDocked = useDisplayStore((state) => state.paneDocked);
  const displayMode = useDisplayStore((state) => state.displayMode);
  return (
    <p>
      {paneDocked ? "docked" : "floating"} {displayMode}
    </p>
  );
}

describe("useDisplayStore during hydration", () => {
  const resetStore = createStoreResetter(useDisplayStore);
  beforeEach(resetStore);
  afterEach(resetStore);

  it("renders the defaults the server rendered, then the stored preferences", async () => {
    // persist() reads localStorage when the store is created, so on a real load the
    // store already holds the visitor's values before React hydrates.
    useDisplayStore.setState({ paneDocked: true, displayMode: "table" });

    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    expect(container.textContent).toBe("floating grid");
    document.body.append(container);

    const logged: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
    const recoverable: unknown[] = [];
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Probe />, {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });
    consoleError.mockRestore();

    expect(recoverable).toEqual([]);
    expect(logged.join("\n")).not.toMatch(/hydrat/iu);
    expect(container.textContent).toBe("docked table");

    root?.unmount();
    container.remove();
  });

  it("gives a component mounted after hydration the stored preferences at once", async () => {
    useDisplayStore.setState({ paneDocked: true });
    const seen: boolean[] = [];
    function Recorder() {
      seen.push(useDisplayStore((state) => state.paneDocked));
      return null;
    }
    const { render } = await import("@testing-library/react");
    render(<Recorder />);
    expect(seen).toEqual([true]);
  });
});
