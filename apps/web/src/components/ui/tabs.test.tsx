import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs";

function nativeButtonMessages(ui: ReactElement) {
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  render(ui);
  const calls = [...errors.mock.calls, ...warnings.mock.calls].map((call) => String(call[0]));
  errors.mockRestore();
  warnings.mockRestore();
  return calls.filter((text) => text.includes("nativeButton"));
}

describe("TabsTrigger", () => {
  it("renders a link trigger without a Base UI nativeButton message", () => {
    expect(
      nativeButtonMessages(
        <Tabs value="rounds">
          <TabsList>
            <TabsTrigger value="rounds" render={<a href="/rounds" aria-label="Rounds" />}>
              Rounds
            </TabsTrigger>
          </TabsList>
        </Tabs>,
      ),
    ).toEqual([]);
  });

  it("keeps a plain trigger a native button", () => {
    const view = render(
      <Tabs value="rounds">
        <TabsList>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(view.getByRole("tab", { name: "Rounds" }).tagName).toBe("BUTTON");
  });
});
