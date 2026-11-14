import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureEnabled: () => true }));

const { FeatureShowcase } = await import("./feature-showcase");

const INTERACTIVE =
  "button, input, select, textarea, [role=button], [tabindex]:not([tabindex='-1'])";

describe("FeatureShowcase", () => {
  it("keeps every interactive element out of the row links", () => {
    const { container } = render(<FeatureShowcase scanCards={[]} thumbnailUrls={[]} />);

    const links = [...container.querySelectorAll("a")];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.querySelectorAll(INTERACTIVE)).toHaveLength(0);
    }
    expect(container.querySelectorAll(INTERACTIVE)).toHaveLength(0);
  });

  it("gives each row one link to its page", () => {
    const { container } = render(<FeatureShowcase scanCards={[]} thumbnailUrls={[]} />);

    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
      "/scan",
      "/collections",
      "/groups",
      "/cards",
    ]);
  });
});
