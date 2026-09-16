import type { AdminMetaEventCorrection } from "@openrift/shared/contracts/admin/meta-submissions";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ apply: vi.fn(), isPending: false }));

vi.mock("@/features/admin/hooks/use-admin-meta-submissions", () => ({
  useApplyMetaEventCorrection: () => ({ mutate: captured.apply, isPending: captured.isPending }),
}));

vi.mock("@/features/admin/components/meta-submission-resolve", () => ({
  MetaSubmissionResolve: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/admin/meta/event-1">{children}</a>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MetaEventCorrectionCard } from "./meta-event-correction-card";

function correction(overrides: Partial<AdminMetaEventCorrection> = {}): AdminMetaEventCorrection {
  return {
    submission: {
      id: "sub-1",
      eventName: "Summoner Skirmish",
      playerName: null,
      kind: "event_correction",
      note: "The flyer says 32 players.",
      status: "pending",
      reason: null,
      resolutionNote: null,
      acceptedDeckId: null,
      createdAt: "2026-09-01T10:00:00.000Z",
      resolvedAt: null,
    },
    event: {
      id: "event-1",
      slug: "summoner-skirmish",
      name: "Summoner Skirmish",
      eventDate: "2026-08-15",
      format: "constructed",
      playerCount: 24,
      organizer: null,
      location: "Piltover",
      country: null,
    },
    fieldEdits: { playerCount: 32, location: "Piltover", country: "DE" },
    ...overrides,
  };
}

describe("MetaEventCorrectionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.isPending = false;
  });

  it("applies every differing field when all stay ticked", async () => {
    const user = userEvent.setup();
    render(<MetaEventCorrectionCard correction={correction()} />);

    await user.click(screen.getByRole("button", { name: "Apply 2 changes" }));

    expect(captured.apply).toHaveBeenCalledWith({ submissionId: "sub-1", fields: null });
  });

  it("offers no checkbox for a value the event already shows", () => {
    render(<MetaEventCorrectionCard correction={correction()} />);

    expect(screen.getByRole("checkbox", { name: "Apply Players" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Apply Country" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Apply Venue" })).not.toBeInTheDocument();
    expect(screen.getByText("(already shown)")).toBeInTheDocument();
  });

  it("applies only the fields left ticked", async () => {
    const user = userEvent.setup();
    render(<MetaEventCorrectionCard correction={correction()} />);

    await user.click(screen.getByRole("checkbox", { name: "Apply Players" }));
    await user.click(screen.getByRole("button", { name: "Apply 1 change" }));

    expect(captured.apply).toHaveBeenCalledWith({ submissionId: "sub-1", fields: ["country"] });
  });

  it("disables the button once nothing is ticked", async () => {
    const user = userEvent.setup();
    render(<MetaEventCorrectionCard correction={correction()} />);

    await user.click(screen.getByRole("checkbox", { name: "Apply Players" }));
    await user.click(screen.getByRole("checkbox", { name: "Apply Country" }));

    expect(screen.getByRole("button", { name: "Apply 0 changes" })).toBeDisabled();
  });

  it("offers no apply when the event is gone", () => {
    render(<MetaEventCorrectionCard correction={correction({ event: null })} />);

    expect(screen.queryByRole("button", { name: /^Apply/u })).not.toBeInTheDocument();
    expect(screen.getByText(/nothing to apply/u)).toBeInTheDocument();
  });

  it("offers no apply when every proposed value is already shown", () => {
    render(
      <MetaEventCorrectionCard correction={correction({ fieldEdits: { location: "Piltover" } })} />,
    );

    expect(screen.queryByRole("button", { name: /^Apply/u })).not.toBeInTheDocument();
  });
});
