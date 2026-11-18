import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const setHidden = vi.fn();

vi.mock("@/features/stage/hooks/use-overlay", () => ({
  usePushOverlayCard: () => ({ mutate: push }),
  useSetOverlayHidden: () => ({ mutate: setHidden }),
  useOverlayChannel: () => ({ data: { payload: { hidden: false } } }),
}));
vi.mock("@/features/stage/hooks/use-overlay-board-sync", () => ({
  useOverlayBoardSync: () => {},
}));

const { StageOverlayHideKey, StageOverlayPushKey } = await import("./stage-obs-keys");

function consumeOnDocument(run: () => void) {
  const consume = (event: KeyboardEvent) => event.preventDefault();
  document.addEventListener("keydown", consume);
  run();
  document.removeEventListener("keydown", consume);
}

describe("stage OBS keys", () => {
  beforeEach(() => {
    push.mockClear();
    setHidden.mockClear();
  });

  it("pushes and hides from the keyboard", () => {
    render(
      <>
        <StageOverlayPushKey printingId="p-1" />
        <StageOverlayHideKey />
      </>,
    );
    fireEvent.keyDown(document.body, { key: "p" });
    fireEvent.keyDown(document.body, { key: "h" });

    expect(push).toHaveBeenCalledWith({ printingId: "p-1" });
    expect(setHidden).toHaveBeenCalledWith({ hidden: true });
  });

  it("leaves keys a document-level handler consumed", () => {
    render(
      <>
        <StageOverlayPushKey printingId="p-1" />
        <StageOverlayHideKey />
      </>,
    );
    consumeOnDocument(() => {
      fireEvent.keyDown(document.body, { key: "p" });
      fireEvent.keyDown(document.body, { key: "h" });
    });

    expect(push).not.toHaveBeenCalled();
    expect(setHidden).not.toHaveBeenCalled();
  });
});
