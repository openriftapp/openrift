import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListState } from "./list-state";

function renderState(state: { isPending: boolean; error: Error | null }) {
  return render(
    <ListState {...state} toolbar={<span>Segments</span>}>
      <p>Nothing is waiting for review.</p>
    </ListState>,
  );
}

describe("ListState", () => {
  it("keeps the empty text away while the list loads", () => {
    renderState({ isPending: true, error: null });
    expect(screen.getByText("Segments")).toBeInTheDocument();
    expect(screen.queryByText("Nothing is waiting for review.")).not.toBeInTheDocument();
  });

  it("says the list failed to load in place of the empty text", () => {
    renderState({ isPending: false, error: new Error("offline") });
    expect(screen.getByRole("alert")).toHaveTextContent("This list could not be loaded. offline");
    expect(screen.queryByText("Nothing is waiting for review.")).not.toBeInTheDocument();
  });

  it("shows the list once it loaded", () => {
    renderState({ isPending: false, error: null });
    expect(screen.getByText("Nothing is waiting for review.")).toBeInTheDocument();
    expect(screen.queryByText("Segments")).not.toBeInTheDocument();
  });
});
