import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FaceFieldEditor } from "./face-field-editor";

vi.mock("@/features/cards/hooks/use-sets", () => ({ useSets: () => ({ data: { sets: [] } }) }));
vi.mock("@/hooks/use-keyword-styles", () => ({ useCostKeywords: () => [] }));

function renderEditor(field: "publicCode" | "flavorText", value: unknown) {
  render(
    <FaceFieldEditor
      field={field}
      def={undefined}
      value={value}
      pending={false}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

describe("FaceFieldEditor", () => {
  it("refuses to save a blank public code, which the schema requires", () => {
    renderEditor("publicCode", "");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves a blank optional field", () => {
    renderEditor("flavorText", "");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows why the save failed under the field", () => {
    render(
      <FaceFieldEditor
        field="flavorText"
        def={undefined}
        value=""
        pending={false}
        error="Could not save the field."
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Could not save the field.")).toBeVisible();
  });
});
