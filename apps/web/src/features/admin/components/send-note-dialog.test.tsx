import type { AdminCardSubmission } from "@openrift/shared/contracts/admin/card-submissions";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  submission: null as AdminCardSubmission | null,
  setResolution: vi.fn(),
}));

vi.mock("@/features/admin/hooks/use-admin-card-submissions", () => ({
  useSubmissionForCandidate: () => ({ data: { submission: captured.submission } }),
  useSetSubmissionResolution: () => ({ mutateAsync: captured.setResolution, isPending: false }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { SendNoteDialog } from "./send-note-dialog";

describe("SendNoteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.submission = null;
    captured.setResolution.mockResolvedValue(undefined);
  });

  it("names the contributor and offers no canned reasons", async () => {
    render(<SendNoteDialog candidateCardId="cand-1" submitterName="Ekko" onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Note to Ekko");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("writes the note without deciding anything", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <SendNoteDialog candidateCardId="cand-1" submitterName="Ekko" onOpenChange={onOpenChange} />,
    );
    await user.type(await screen.findByRole("textbox"), "Which set is this from?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(captured.setResolution).toHaveBeenCalledWith({
      candidateCardId: "cand-1",
      reason: null,
      note: "Which set is this from?",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps a reason that was already recorded", async () => {
    captured.submission = { reason: "unverified", resolutionNote: "Earlier note" } as never;
    const user = userEvent.setup();
    render(<SendNoteDialog candidateCardId="cand-1" submitterName="Ekko" onOpenChange={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Send" }));

    expect(captured.setResolution).toHaveBeenCalledWith({
      candidateCardId: "cand-1",
      reason: "unverified",
      note: "Earlier note",
    });
  });
});
