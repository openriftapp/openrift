import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reloadIfNewVersionPending = vi.fn<() => boolean>();

vi.mock("@/lib/stale-bundle-reload", () => ({
  reloadIfNewVersionPending: () => reloadIfNewVersionPending(),
}));

const { RouterErrorFallback } = await import("./error-fallback");

function renderFallback() {
  return render(<RouterErrorFallback error={new Error("boom")} reset={() => {}} />);
}

describe("RouterErrorFallback", () => {
  beforeEach(() => {
    reloadIfNewVersionPending.mockReturnValue(false);
  });

  it("renders the error page when no new version is pending", () => {
    const { queryByRole } = renderFallback();
    expect(queryByRole("heading")).not.toBeNull();
  });

  it("reloads instead of rendering the error page when a new version is pending", () => {
    reloadIfNewVersionPending.mockReturnValue(true);
    const { queryByRole } = renderFallback();
    expect(reloadIfNewVersionPending).toHaveBeenCalledOnce();
    expect(queryByRole("heading")).toBeNull();
  });
});
