import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderBare, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/contribute/components/card-text-input", () => ({
  CardTextInput: () => <textarea aria-label="Text" />,
}));

import { CardTextExpandDialog } from "./card-text-expand-dialog";

function render(ui: React.ReactElement) {
  return renderBare(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Expand Rules editor" }));
}

describe("CardTextExpandDialog", () => {
  it("keeps the dialog open and shows the message when the save is refused", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => false);
    render(
      <CardTextExpandDialog
        label="Rules"
        value="Draw 1."
        onSave={onSave}
        requiredError="Rules is required."
      />,
    );

    await openDialog(user);
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(onSave).toHaveBeenCalledWith("");
    expect(screen.getByRole("alert")).toHaveTextContent("Rules is required.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog when the save is accepted", async () => {
    const user = userEvent.setup();
    render(<CardTextExpandDialog label="Rules" value="Draw 1." onSave={vi.fn()} />);

    await openDialog(user);
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
