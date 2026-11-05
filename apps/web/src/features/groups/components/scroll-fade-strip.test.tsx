import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScrollEdges } from "@/hooks/use-scroll-edges";

const edges = vi.hoisted(() => ({ value: { start: false, end: false } as ScrollEdges }));
vi.mock("@/hooks/use-scroll-edges", () => ({
  useScrollEdges: () => ({ ref: () => {}, edges: edges.value }),
}));

const { ScrollFadeStrip } = await import("./scroll-fade-strip");

function renderStrip(next: ScrollEdges) {
  edges.value = next;
  return render(
    <ScrollFadeStrip>
      <span>Summoner Skirmish</span>
    </ScrollFadeStrip>,
  );
}

describe("ScrollFadeStrip", () => {
  it("renders its children without fades when nothing is hidden", () => {
    const { container } = renderStrip({ start: false, end: false });

    expect(screen.getByText("Summoner Skirmish")).toBeVisible();
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
  });

  it("fades the end edge when content overflows to the right", () => {
    const { container } = renderStrip({ start: false, end: true });

    expect(container.querySelector(".lucide-chevron-right")).not.toBeNull();
    expect(container.querySelector(".lucide-chevron-left")).toBeNull();
  });

  it("fades both edges mid-scroll", () => {
    const { container } = renderStrip({ start: true, end: true });

    expect(container.querySelector(".lucide-chevron-left")).not.toBeNull();
    expect(container.querySelector(".lucide-chevron-right")).not.toBeNull();
  });
});
