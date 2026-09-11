import type { AdminPrintingCitation } from "@openrift/shared/types/api/admin";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  citations: [] as AdminPrintingCitation[],
  isPending: false,
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/features/admin/hooks/use-admin-printing-citations", () => ({
  useAdminPrintingCitations: () => ({
    data: { citations: captured.citations },
    isPending: captured.isPending,
  }),
  useCreatePrintingCitation: () => ({ mutateAsync: captured.create, isPending: false }),
  useUpdatePrintingCitation: () => ({ mutateAsync: captured.update, isPending: false }),
  useDeletePrintingCitation: () => ({ mutate: captured.remove, isPending: false }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { PrintingCitationsEditor } from "./printing-citations-editor";

const PRINTING_ID = "b0000000-0001-4000-a000-000000000001";

const citation: AdminPrintingCitation = {
  id: "c-1",
  label: "Launch party unboxing (RiftboundDaily)",
  sourceUrl: "https://www.youtube.com/watch?v=abc123",
  canEdit: true,
};

beforeEach(() => {
  captured.citations = [];
  captured.isPending = false;
  captured.create.mockReset().mockResolvedValue(citation);
  captured.update.mockReset().mockResolvedValue(undefined);
  captured.remove.mockReset();
});

describe("PrintingCitationsEditor", () => {
  it("offers only the add button until it is pressed", async () => {
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    expect(screen.queryByLabelText("Source name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add source link/iu }));

    expect(screen.getByLabelText("Source name")).toBeInTheDocument();
  });

  it("lists a citation the way the card page renders it", () => {
    captured.citations = [citation];

    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    expect(screen.getByRole("link", { name: citation.label })).toHaveAttribute(
      "href",
      citation.sourceUrl,
    );
  });

  it("adds a citation, trimming the fields", async () => {
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: /add source link/iu }));
    await user.type(screen.getByLabelText("Source name"), "  Unboxing  ");
    await user.type(screen.getByLabelText("Source link"), "  https://youtu.be/abc  ");
    await user.click(screen.getByRole("button", { name: /add source link/iu }));

    expect(captured.create).toHaveBeenCalledWith({
      printingId: PRINTING_ID,
      label: "Unboxing",
      sourceUrl: "https://youtu.be/abc",
    });
  });

  it("sends a null link, not an empty string, when the field is left blank", async () => {
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: /add source link/iu }));
    await user.type(screen.getByLabelText("Source name"), "Riot CM in the official Discord");
    await user.click(screen.getByRole("button", { name: /add source link/iu }));

    expect(captured.create).toHaveBeenCalledWith({
      printingId: PRINTING_ID,
      label: "Riot CM in the official Discord",
      sourceUrl: null,
    });
  });

  it("closes the form after a successful add", async () => {
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: /add source link/iu }));
    await user.type(screen.getByLabelText("Source name"), "Unboxing");
    await user.click(screen.getByRole("button", { name: /add source link/iu }));

    expect(screen.queryByLabelText("Source name")).not.toBeInTheDocument();
  });

  it("keeps the form filled when the add fails", async () => {
    captured.create.mockRejectedValue(new Error("conflict"));
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: /add source link/iu }));
    await user.type(screen.getByLabelText("Source name"), "Unboxing");
    await user.click(screen.getByRole("button", { name: /add source link/iu }));

    expect(screen.getByLabelText("Source name")).toHaveValue("Unboxing");
  });

  it("cannot add a citation with no label", async () => {
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: /add source link/iu }));

    expect(screen.getByRole("button", { name: /add source link/iu })).toBeDisabled();
  });

  it("edits a citation in place", async () => {
    captured.citations = [citation];
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: `Edit source link ${citation.label}` }));
    const labelInput = screen.getByLabelText("Source name");
    await user.clear(labelInput);
    await user.type(labelInput, "Unboxing, re-watched");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(captured.update).toHaveBeenCalledWith({
      printingId: PRINTING_ID,
      citationId: citation.id,
      label: "Unboxing, re-watched",
      sourceUrl: citation.sourceUrl,
    });
  });

  it("deletes a citation", async () => {
    captured.citations = [citation];
    const user = userEvent.setup();
    render(<PrintingCitationsEditor printingId={PRINTING_ID} />);

    await user.click(screen.getByRole("button", { name: `Delete source link ${citation.label}` }));

    expect(captured.remove).toHaveBeenCalledWith({
      printingId: PRINTING_ID,
      citationId: citation.id,
    });
  });
});
