import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ reject: vi.fn() }));

vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useRejectSubmission: () => ({ mutateAsync: captured.reject, isPending: false }),
}));

import { RejectSubmissionDialog } from "./reject-submission-dialog";

function renderDialog(
  onOpenChange = vi.fn(),
  runWrite?: React.ComponentProps<typeof RejectSubmissionDialog>["runWrite"],
) {
  render(
    <RejectSubmissionDialog
      candidateCardId="cand-1"
      submitterName="Renata"
      kindLabel="Correction"
      onOpenChange={onOpenChange}
      runWrite={runWrite}
    />,
  );
  return onOpenChange;
}

async function pickReason(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByLabelText("Reason"));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("RejectSubmissionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.reject.mockResolvedValue(undefined);
  });

  it("names the contributor and the kind, with no reason picked yet", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Reject Renata's correction");
    expect(dialog).not.toHaveTextContent("They will read:");
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("does not reject from the keyboard before a reason is picked", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(
      await screen.findByLabelText("Your own words (optional)"),
      "Seen it before{Enter}",
    );

    expect(captured.reject).not.toHaveBeenCalled();
  });

  it("sends the picked reason and the message", async () => {
    const user = userEvent.setup();
    const onOpenChange = renderDialog();
    await pickReason(user, "Could not verify");
    await user.type(screen.getByLabelText("Your own words (optional)"), "No source for this one");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(captured.reject).toHaveBeenCalledWith(
      {
        candidateCardId: "cand-1",
        reason: "unverified",
        note: "No source for this one",
      },
      { signal: undefined },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends a null message when the box is left empty", async () => {
    const user = userEvent.setup();
    renderDialog();
    await pickReason(user, "Already submitted");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(captured.reject).toHaveBeenCalledWith(
      {
        candidateCardId: "cand-1",
        reason: "duplicate",
        note: null,
      },
      { signal: undefined },
    );
  });

  it("asks for a message when the reason is other", async () => {
    const user = userEvent.setup();
    renderDialog();
    await pickReason(user, "Other");

    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    await user.type(screen.getByLabelText("Your own words (optional)"), "Wrong set");
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("hands the rejection to runWrite, which passes its signal into the mutation", async () => {
    const user = userEvent.setup();
    const { signal } = new AbortController();
    const runWrite = vi.fn((write: (signal?: AbortSignal) => Promise<unknown>) =>
      write(signal).then(() => true),
    );
    const onOpenChange = renderDialog(vi.fn(), runWrite);
    await pickReason(user, "Already submitted");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(runWrite).toHaveBeenCalledOnce();
    expect(captured.reject).toHaveBeenCalledWith(
      { candidateCardId: "cand-1", reason: "duplicate", note: null },
      { signal },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
