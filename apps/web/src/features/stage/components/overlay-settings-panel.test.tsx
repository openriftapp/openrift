import { DEFAULT_OVERLAY_PAYLOAD } from "@openrift/shared/contracts/overlay";
import type { OverlayChannelResponse } from "@openrift/shared/contracts/overlay";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDisable, mockUpdate } = vi.hoisted(() => ({
  mockDisable: vi.fn(),
  mockUpdate: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/features/stage/hooks/use-overlay", () => ({
  useEnableOverlayToken: () => ({ mutate: vi.fn(), isPending: false }),
  useDisableOverlayToken: () => ({ mutate: mockDisable, isPending: false }),
  useUpdateOverlaySettings: () => ({ mutate: vi.fn(), mutateAsync: mockUpdate, isPending: false }),
}));

vi.mock("@/features/stage/components/overlay-presets-section", () => ({
  OverlayPresetsSection: () => null,
}));

vi.mock("@/lib/site-config", () => ({
  getSiteUrl: () => "https://preview.example.test",
}));

const { OverlaySettingsPanel } = await import("./overlay-settings-panel");

const CHANNEL: OverlayChannelResponse = {
  token: "tok-1",
  version: 1,
  payload: DEFAULT_OVERLAY_PAYLOAD,
  updatedAt: "2026-11-01T10:00:00Z",
};

async function confirmDisable() {
  const user = userEvent.setup();
  render(<OverlaySettingsPanel channel={CHANNEL} draftScale={null} onDraftScaleChange={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Disable" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Disable link" }));
}

describe("OverlaySettingsPanel disable link", () => {
  beforeEach(() => {
    mockDisable.mockReset();
  });

  it("keeps the confirmation open when disabling fails", async () => {
    mockDisable.mockImplementation((_vars: unknown, options?: { onError?: () => void }) => {
      options?.onError?.();
    });
    await confirmDisable();

    expect(mockDisable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes the confirmation once the link is disabled", async () => {
    mockDisable.mockImplementation((_vars: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    await confirmDisable();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("OverlaySettingsPanel QR link", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
  });

  function panel(qrUrl: string | null) {
    return (
      <OverlaySettingsPanel
        channel={{ ...CHANNEL, payload: { ...DEFAULT_OVERLAY_PAYLOAD, qrUrl } }}
        draftScale={null}
        onDraftScaleChange={vi.fn()}
      />
    );
  }

  it("follows a URL a preset put in place, and a focus and blur writes nothing", async () => {
    const user = userEvent.setup();
    const { rerender } = render(panel("https://preview.example.test/decks/share/old"));

    rerender(panel("https://preview.example.test/decks/share/preset"));
    const field = screen.getByLabelText("Link to put on screen");
    expect(field).toHaveValue("https://preview.example.test/decks/share/preset");

    await user.click(field);
    await user.tab();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("writes an edited URL on blur", async () => {
    const user = userEvent.setup();
    render(panel(null));
    const field = screen.getByLabelText("Link to put on screen");

    await user.type(field, "https://preview.example.test/decks/share/new");
    await user.tab();

    expect(mockUpdate).toHaveBeenCalledWith({
      qrUrl: "https://preview.example.test/decks/share/new",
    });
  });
});
