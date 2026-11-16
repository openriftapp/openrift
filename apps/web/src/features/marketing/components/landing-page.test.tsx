import type * as ReactQuery from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

const fanMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQuery: () => ({ data: undefined }),
}));
vi.mock("@tanstack/react-router", () => ({ Link: () => null }));
vi.mock("@/hooks/use-idle-preload-route", () => ({ useIdlePreloadRoute: () => {} }));
vi.mock("./feature-showcase", () => ({ FeatureShowcase: () => null }));
vi.mock("./landing-closing", () => ({ LandingClosing: () => null }));
vi.mock("./hero-ctas", () => ({ HeroCtas: () => null }));
vi.mock("./card-fan", async () => {
  const { useEffect } = await import("react");
  return {
    CollectCardFan: ({
      hinting,
      onAllCollected,
    }: {
      hinting?: boolean;
      onAllCollected?: () => void;
    }) => {
      useEffect(() => {
        fanMounts.count += 1;
      }, []);
      return (
        <div data-hinting={hinting ? "yes" : "no"}>
          <Button onClick={onAllCollected}>collect all</Button>
        </div>
      );
    },
  };
});

const { LandingPage } = await import("./landing-page");

function logo(): HTMLImageElement {
  const image = screen.getByRole("button", { name: "OpenRift" }).querySelector("img");
  if (!image) {
    throw new Error("logo image missing");
  }
  return image;
}

describe("LandingPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    fanMounts.count = 0;
  });

  it("spins the logo after every card is collected and deals a new fan when the spin ends", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByText("collect all"));

    expect(logo()).toHaveClass("animate-logo-spin");
    expect(fanMounts.count).toBe(1);

    fireEvent.animationEnd(logo());

    expect(logo()).not.toHaveClass("animate-logo-spin");
    expect(fanMounts.count).toBe(2);
  });

  it("hints the fan briefly on a logo tap", () => {
    vi.useFakeTimers();
    const { container } = render(<LandingPage />);

    fireEvent.click(screen.getByRole("button", { name: "OpenRift" }));
    expect(container.querySelector<HTMLElement>("[data-hinting]")?.dataset.hinting).toBe("yes");

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector<HTMLElement>("[data-hinting]")?.dataset.hinting).toBe("no");
  });

  it("leaves no timer running after it unmounts mid-hint", () => {
    vi.useFakeTimers();
    const { unmount } = render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "OpenRift" }));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
