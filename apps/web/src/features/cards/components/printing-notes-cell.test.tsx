import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrintingNotesCell } from "./printing-notes-cell";

vi.mock("@/hooks/use-coarse-pointer", () => ({ useCoarsePointer: () => true }));

describe("PrintingNotesCell", () => {
  it("renders nothing when the printing has no note, markers or citations", () => {
    const { container } = render(<PrintingNotesCell comment={null} markers={[]} citations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("chips the markers that say why the printing exists, dropping the generic Promo one", () => {
    const { getByText, queryByText } = render(
      <PrintingNotesCell
        comment={null}
        markers={[
          { id: "m-1", slug: "promo", label: "Promo", description: null },
          { id: "m-2", slug: "top-8", label: "Top 8", description: "Awarded to the top 8." },
        ]}
        citations={[]}
      />,
    );
    expect(getByText("Top 8")).not.toBeNull();
    expect(queryByText("Promo")).toBeNull();
  });

  it("renders nothing when the only marker is the generic Promo one", () => {
    const { container } = render(
      <PrintingNotesCell
        comment={null}
        markers={[{ id: "m-1", slug: "promo", label: "Promo", description: null }]}
        citations={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("spells the note out in the cell, behind a container query", () => {
    // jsdom resolves no container query, so the class is the assertable part.
    const { getByText } = render(
      <PrintingNotesCell comment="Handed out at the launch event" markers={[]} citations={[]} />,
    );
    const note = getByText("Handed out at the launch event");
    expect(note.className).toContain("@[10rem]:inline");
    expect(note.className).toContain("hidden");
  });

  it("links a citation that has a URL and opens it in a new tab", () => {
    const { getByLabelText } = render(
      <PrintingNotesCell
        comment={null}
        markers={[]}
        citations={[
          { id: "c-1", label: "Reveal stream", sourceUrl: "https://twitch.tv/riftbound" },
        ]}
      />,
    );
    const link = getByLabelText("Reveal stream");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("still shows a citation with no permalink, unlinked", () => {
    const { getByLabelText } = render(
      <PrintingNotesCell
        comment={null}
        markers={[]}
        citations={[{ id: "c-1", label: "Convention handout", sourceUrl: null }]}
      />,
    );
    expect(getByLabelText(/Convention handout/u).tagName).not.toBe("A");
  });

  it("opens an unlinked citation's label with a tap, without reaching the row", () => {
    const onRowClick = vi.fn();
    const { getByRole, getAllByText } = render(
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stands in for the clickable table row
      <div onClick={onRowClick}>
        <PrintingNotesCell
          comment={null}
          markers={[]}
          citations={[{ id: "c-1", label: "Convention handout", sourceUrl: null }]}
        />
      </div>,
    );
    fireEvent.click(getByRole("button", { name: /Convention handout/u }));
    expect(getAllByText("Convention handout")).toHaveLength(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps a tap on the note from reaching the row behind it", () => {
    const onRowClick = vi.fn();
    const { getByRole } = render(
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stands in for the clickable table row
      <div onClick={onRowClick}>
        <PrintingNotesCell comment="Handed out at the launch event" markers={[]} citations={[]} />
      </div>,
    );
    fireEvent.click(getByRole("button", { name: /Printing note/u }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("opens the note with a tap on a coarse pointer", () => {
    const { getByRole, getAllByText } = render(
      <PrintingNotesCell comment="Handed out at the launch event" markers={[]} citations={[]} />,
    );
    fireEvent.click(getByRole("button", { name: /Printing note/u }));
    expect(getAllByText("Handed out at the launch event")).toHaveLength(2);
  });
});
