import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFieldDraft } from "./use-field-draft";

function DraftField({ defaultValue }: { defaultValue: string }) {
  const { ref: fieldRef, draft, handleInput: handleDraftInput } = useFieldDraft<HTMLInputElement>();
  return (
    <>
      <input
        aria-label="Name"
        ref={fieldRef}
        defaultValue={defaultValue}
        onInput={handleDraftInput}
      />
      <p>{draft === undefined ? "none" : `draft: ${draft}`}</p>
    </>
  );
}

describe("useFieldDraft", () => {
  it("reads the field's value once mounted", () => {
    render(<DraftField defaultValue="Jinx" />);
    expect(screen.getByText("draft: Jinx")).toBeInTheDocument();
  });

  it("follows each edit without writing the field", () => {
    render(<DraftField defaultValue="Jinx" />);
    const input = screen.getByLabelText("Name") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "Vi" } });

    expect(screen.getByText("draft: Vi")).toBeInTheDocument();
    expect(input.value).toBe("Vi");
  });
});
