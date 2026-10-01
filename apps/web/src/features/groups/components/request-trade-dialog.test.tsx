import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RequestableCopy } from "./request-trade-dialog";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: {
      conditions: { "near-mint": "Near Mint", "light-played": "Light Played" },
      graders: { psa: "PSA" },
    },
  }),
}));

const { RequestTradeDialog } = await import("./request-trade-dialog");

function copy(copyId: string, condition: string | null): RequestableCopy {
  return { copyId, condition, grader: null, grade: null, notesPublic: null };
}

function renderDialog(props: {
  mode?: "request" | "offer";
  copies?: RequestableCopy[];
  demandQuantity?: number;
  canExceedWish?: boolean;
  onConfirm?: (quantity: number, copyIds?: string[]) => void;
}) {
  const copies = props.copies ?? [];
  render(
    <RequestTradeDialog
      open
      onOpenChange={() => {}}
      mode={props.mode ?? "request"}
      cardName="Teemo, Scout"
      availableCount={copies.length}
      demandQuantity={props.demandQuantity ?? 1}
      pending={false}
      copies={props.copies}
      canExceedWish={props.canExceedWish}
      onConfirm={props.onConfirm ?? (() => {})}
    />,
  );
}

describe("RequestTradeDialog", () => {
  it("asks which copy when the copies differ and sends the picked one", async () => {
    const onConfirm = vi.fn();
    renderDialog({
      copies: [copy("copy-nm", "near-mint"), copy("copy-lp", "light-played")],
      onConfirm,
    });

    expect(screen.getByText("Which copy?")).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: "Light Played" }));
    expect(screen.getByRole("checkbox", { name: "Near Mint" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(onConfirm).toHaveBeenCalledWith(1, ["copy-lp"]);
  });

  it("caps the pick at the wanted count", async () => {
    renderDialog({
      copies: [
        copy("copy-nm", "near-mint"),
        copy("copy-lp", "light-played"),
        copy("copy-nm-2", "near-mint"),
      ],
      demandQuantity: 2,
    });

    expect(screen.getByText("Pick up to 2 copies")).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["true", "true", "false"]);
    expect(
      boxes[2]?.hasAttribute("disabled") || boxes[2]?.getAttribute("aria-disabled"),
    ).toBeTruthy();
  });

  it("lets a request go past the wishlist and says the wishlist goes up", async () => {
    const onConfirm = vi.fn();
    renderDialog({
      copies: [copy("copy-nm", "near-mint"), copy("copy-lp", "light-played")],
      demandQuantity: 1,
      canExceedWish: true,
      onConfirm,
    });

    expect(screen.getByText("Pick up to 2 copies")).toBeTruthy();
    expect(screen.queryByText(/Your wishlist goes up/u)).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "Light Played" }));
    expect(screen.getByText("Your wishlist goes up to 2 copies.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(onConfirm).toHaveBeenCalledWith(2, ["copy-nm", "copy-lp"]);
  });

  it("keeps the count stepper when every copy looks the same", async () => {
    const onConfirm = vi.fn();
    renderDialog({
      copies: [copy("copy-a", "near-mint"), copy("copy-b", "near-mint")],
      demandQuantity: 2,
      onConfirm,
    });

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("How many?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onConfirm).toHaveBeenCalledWith(2);
  });

  it("never asks for copies on an offer", () => {
    renderDialog({
      mode: "offer",
      copies: [copy("copy-nm", "near-mint"), copy("copy-lp", "light-played")],
    });

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
