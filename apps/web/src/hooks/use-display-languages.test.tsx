import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { createStoreResetter } from "@/test/store-helpers";

import { ServerDisplayLanguagesProvider, useDisplayLanguages } from "./use-display-languages";

const resetDisplayStore = createStoreResetter(useDisplayStore);

function Languages() {
  return <span>{useDisplayLanguages().join(",")}</span>;
}

afterEach(() => {
  resetDisplayStore();
});

describe("useDisplayLanguages", () => {
  it("renders the server's languages before hydration, whatever the store holds", () => {
    useDisplayStore.getState().setLanguages(["FR"]);
    const html = renderToString(
      <ServerDisplayLanguagesProvider value={["DE", "EN"]}>
        <Languages />
      </ServerDisplayLanguagesProvider>,
    );
    expect(html).toContain("DE,EN");
  });

  it("renders the defaults before hydration when the server had no languages", () => {
    useDisplayStore.getState().setLanguages(["FR"]);
    expect(renderToString(<Languages />)).toContain("EN");
    expect(renderToString(<Languages />)).not.toContain("FR");
  });

  it("keeps the same list across hydration when the languages are equal", async () => {
    const seen: (readonly string[])[] = [];
    function Capture() {
      seen.push(useDisplayLanguages());
      return null;
    }
    const tree = (
      <ServerDisplayLanguagesProvider value={["DE", "EN"]}>
        <Capture />
      </ServerDisplayLanguagesProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    useDisplayStore.getState().setLanguages(["DE", "EN"]);

    await act(async () => {
      hydrateRoot(container, tree);
    });

    expect(seen.length).toBeGreaterThan(2);
    expect(seen.at(-1)).toBe(seen[1]);
  });

  it("follows the store once hydrated", () => {
    useDisplayStore.getState().setLanguages(["FR"]);
    render(
      <ServerDisplayLanguagesProvider value={["DE"]}>
        <Languages />
      </ServerDisplayLanguagesProvider>,
    );
    expect(screen.getByText("FR")).toBeTruthy();
  });
});
