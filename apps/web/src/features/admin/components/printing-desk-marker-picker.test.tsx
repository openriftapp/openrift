import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  created: null as unknown,
}));

function marker(overrides: Record<string, unknown>) {
  return {
    id: "x",
    slug: "x",
    label: "X",
    description: null,
    ...overrides,
  };
}

const markers = [
  marker({ id: "m1", slug: "nexus-stamp", label: "Nexus stamp", description: "Gold foil" }),
  marker({ id: "m2", slug: "artist-signature", label: "Artist signature" }),
];

vi.mock("@/features/admin/hooks/use-markers", () => ({
  useMarkers: () => ({ data: { markers } }),
  useCreateMarker: () => ({
    isPending: false,
    mutateAsync: (input: unknown) => {
      captured.created = input;
      return Promise.resolve();
    },
  }),
}));

const { PrintingDeskMarkerPicker } = await import("./printing-desk-marker-picker");

beforeEach(() => {
  captured.created = null;
});

describe("PrintingDeskMarkerPicker", () => {
  it("finds a marker and shows its description", async () => {
    const user = userEvent.setup();
    render(<PrintingDeskMarkerPicker value={[]} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Printed on the card"), "stamp");

    expect(await screen.findByRole("option", { name: /Nexus stamp/u })).toBeInTheDocument();
    expect(screen.getByText("Gold foil")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Artist signature/u })).not.toBeInTheDocument();
  });

  it("adds the picked marker with the arrow keys and clears the search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrintingDeskMarkerPicker value={["artist-signature"]} onChange={onChange} />);

    await user.type(screen.getByLabelText("Printed on the card"), "stamp");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith(["artist-signature", "nexus-stamp"]);
    expect(screen.getByLabelText("Printed on the card")).toHaveValue("");
  });

  it("hides markers that are already picked", async () => {
    const user = userEvent.setup();
    render(<PrintingDeskMarkerPicker value={["nexus-stamp"]} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Printed on the card"), "stamp");

    expect(screen.queryByRole("option", { name: /Nexus stamp/u })).not.toBeInTheDocument();
  });

  it("creates a marker from the typed name and adds it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrintingDeskMarkerPicker value={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText("Printed on the card"), "Prerelease mark");
    await user.click(await screen.findByRole("option", { name: "Add “Prerelease mark”" }));

    expect(captured.created).toEqual({ slug: "prerelease-mark", label: "Prerelease mark" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["prerelease-mark"]));
  });

  it("does not offer to create a marker that exists", async () => {
    const user = userEvent.setup();
    render(<PrintingDeskMarkerPicker value={[]} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Printed on the card"), "nexus stamp");

    expect(screen.queryByRole("option", { name: /^Add/u })).not.toBeInTheDocument();
  });

  it("removes a picked marker from the chips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PrintingDeskMarkerPicker value={["nexus-stamp", "artist-signature"]} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove Nexus stamp" }));

    expect(onChange).toHaveBeenCalledWith(["artist-signature"]);
  });
});
