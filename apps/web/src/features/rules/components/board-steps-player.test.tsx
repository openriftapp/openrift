import type { BoardDocument, BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { emptyBoardDocument } from "@openrift/shared/board-state";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  createLink: (component: unknown) => component,
}));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));

const { BoardStepsPlayer } = await import("./board-steps-player");

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});

const pins = { coreRulesVersion: "1.0", tournamentRulesVersion: null };
const facebreaker = { cardId: "019a0000-0000-7000-8000-000000000002", name: "Facebreaker" };
const merchant = { cardId: "019a0000-0000-7000-8000-000000000003", name: "Traveling Merchant" };

function piece(overrides: Partial<BoardPiece> & { id: string }): BoardPiece {
  return {
    owner: "B",
    zone: { kind: "base" },
    kind: "unit",
    card: merchant,
    exhausted: false,
    keywords: [],
    damage: 0,
    might: 0,
    highlight: false,
    ...overrides,
  };
}

function boardWith(steps: Partial<BoardStep>[]): BoardDocument {
  const document = emptyBoardDocument();
  return {
    ...document,
    zones: {
      ...document.zones,
      legend: false,
      champion: false,
      runes: false,
      hand: true,
      chain: true,
    },
    steps: steps.map((step) => ({ caption: "", pieces: [], chain: [], arrows: [], ...step })),
  };
}

describe("BoardStepsPlayer", () => {
  it("jumps to a step from its pill", () => {
    const onStep = vi.fn();
    render(
      <BoardStepsPlayer
        document={boardWith([{}, {}, {}])}
        pins={pins}
        activeStep={0}
        onStep={onStep}
      />,
    );
    expect(screen.getByRole("button", { name: "Step 1" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Step 3" }));
    expect(onStep).toHaveBeenCalledWith(2);
  });

  it("hides the step controls for a single step", () => {
    render(
      <BoardStepsPlayer document={boardWith([{}])} pins={pins} activeStep={0} onStep={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
  });

  it("lists the chain top first and keeps its space on a step without one", () => {
    const document = boardWith([
      {},
      {
        chain: [
          { owner: "B", card: merchant },
          { owner: "A", card: facebreaker },
        ],
      },
    ]);
    const { rerender } = render(
      <BoardStepsPlayer document={document} pins={pins} activeStep={1} onStep={vi.fn()} />,
    );
    const entries = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(entries.map((entry) => entry.textContent)).toEqual([
      "FacebreakerA",
      "Traveling MerchantB",
    ]);

    rerender(<BoardStepsPlayer document={document} pins={pins} activeStep={0} onStep={vi.fn()} />);
    expect(screen.getByText("Nothing on the chain")).toBeInTheDocument();
  });

  it("draws zones empty in every step as labelled strips", () => {
    const document = boardWith([
      { pieces: [piece({ id: "p1" })] },
      { pieces: [piece({ id: "p1", zone: { kind: "hand" } })] },
    ]);
    render(<BoardStepsPlayer document={document} pins={pins} activeStep={0} onStep={vi.fn()} />);
    expect(screen.getByText("A · Hand")).toBeInTheDocument();
    expect(screen.getByText("A · Base")).toBeInTheDocument();
    expect(screen.queryByText("B · Hand")?.closest("[data-board-zone]")).toHaveAttribute(
      "data-board-zone",
      "hand-B",
    );
  });

  it("shows the step caption", () => {
    render(
      <BoardStepsPlayer
        document={boardWith([{ caption: "The Drake survives." }])}
        pins={pins}
        activeStep={0}
        onStep={vi.fn()}
      />,
    );
    expect(screen.getByText("The Drake survives.")).toBeInTheDocument();
  });
});
