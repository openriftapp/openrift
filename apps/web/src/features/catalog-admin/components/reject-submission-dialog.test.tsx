import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ reject: vi.fn() }));

vi.mock("@/features/catalog-admin/hooks/use-catalog-review", () => ({
  useRejectSubmission: () => ({ mutateAsync: captured.reject, isPending: false }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { RejectSubmissionDialog } from "./reject-submission-dialog";

describe("RejectSubmissionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.reject.mockResolvedValue(undefined);
  });

  it("names the contributor and the kind, and offers no canned reasons", async () => {
    render(
      <RejectSubmissionDialog
        candidateCardId="cand-1"
        submitterName="Renata"
        kindLabel="Correction"
        onOpenChange={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Reject Renata's correction");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("sends the message without a reason", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <RejectSubmissionDialog
        candidateCardId="cand-1"
        submitterName="Renata"
        kindLabel="Correction"
        onOpenChange={onOpenChange}
      />,
    );
    await user.type(
      await screen.findByPlaceholderText("Tell the contributor why (optional)"),
      "Could not verify this printing",
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(captured.reject).toHaveBeenCalledWith({
      candidateCardId: "cand-1",
      note: "Could not verify this printing",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends a null message when the box is left empty", async () => {
    const user = userEvent.setup();
    render(
      <RejectSubmissionDialog
        candidateCardId="cand-1"
        submitterName={null}
        kindLabel="Image"
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Reject" }));

    expect(captured.reject).toHaveBeenCalledWith({ candidateCardId: "cand-1", note: null });
  });
});
