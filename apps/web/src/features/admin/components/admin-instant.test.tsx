import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminInstant } from "./admin-instant";

const AT = "2026-11-13T09:05:00.000Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T12:05:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AdminInstant", () => {
  it("shows the UTC time and puts the gap in the tooltip", () => {
    render(<AdminInstant at={AT} />);
    expect(screen.getByText("2026-11-13 09:05")).toHaveAttribute("title", "3h ago");
  });

  it("shows the gap and puts the UTC time in the tooltip", () => {
    render(<AdminInstant at={AT} relative />);
    expect(screen.getByText("3h ago")).toHaveAttribute("title", "2026-11-13 09:05 UTC");
  });

  it("shows a dash without an instant", () => {
    render(<AdminInstant at={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
