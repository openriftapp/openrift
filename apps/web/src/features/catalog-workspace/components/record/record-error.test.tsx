import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecordError } from "./record-error";

vi.mock("@/components/error-message", () => ({
  RouteErrorFallback: ({ onRetry }: { onRetry: () => void }) => (
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  ),
}));
vi.mock("@/lib/server-fns/api-error", () => ({
  errorStatus: (error: { status?: number }) => error.status,
}));

describe("RecordError", () => {
  it("says the record is missing on a 404", () => {
    render(<RecordError error={{ status: 404 }} missing="No printing here." onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No printing here.");
  });

  it("offers a retry on any other failure", () => {
    render(<RecordError error={{ status: 500 }} missing="No printing here." onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
