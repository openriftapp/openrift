import { labelMapOf } from "@openrift/shared/enum-label";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { draftFromBasePrinting } from "@/features/catalog-workspace/lib/creation-draft";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: { finishes: ["normal", "foil"], rarities: ["common"], cardSizes: ["standard"] },
    labels: { finishes: {}, rarities: {}, cardSizes: {} },
  }),
  useLanguageList: () => [{ code: "EN", name: "English", color: null }],
}));
vi.mock("@/features/cards/hooks/use-sets", () => ({ useSets: () => ({ data: { sets: [] } }) }));
vi.mock("@/features/cards/hooks/use-distinct-artists", () => ({
  useDistinctArtists: () => ({ data: [] }),
}));
vi.mock("@/features/catalog-workspace/hooks/use-value-labels", () => ({
  useValueLabels: () => ({ channels: labelMapOf({}) }),
}));
vi.mock("@/features/admin/hooks/use-distribution-channels", () => ({
  useDistributionChannels: () => ({ data: { distributionChannels: [] } }),
}));
vi.mock("@/features/admin/components/set-picker", () => ({
  SetPicker: () => <button type="button">Pick a set</button>,
}));
vi.mock("@/features/admin/components/language-select", () => ({
  LanguageSelect: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      Language
    </button>
  ),
}));
vi.mock("@/features/admin/components/printing-desk-marker-picker", () => ({
  PrintingDeskMarkerPicker: () => <input aria-label="Markers" />,
}));
vi.mock("@/features/admin/components/printing-desk-channel-picker", () => ({
  PrintingDeskChannelPicker: () => <input aria-label="Channels" />,
}));
vi.mock("@/features/catalog-workspace/components/creation/creation-images", () => ({
  CreationImages: () => null,
}));
vi.mock("@/features/catalog-workspace/components/creation/face-picker", () => ({
  FacePicker: () => null,
}));

const { CreationPanel } = await import("./creation-panel");

const draft = draftFromBasePrinting({ id: "card-1", slug: "ekko", name: "Ekko" }, undefined, {
  language: "EN",
  finish: "normal",
  size: "standard",
});

describe("CreationPanel", () => {
  it("locks the face and printing fields while disabled", () => {
    render(<CreationPanel draft={draft} onChange={vi.fn()} layout="steps" disabled />);

    for (const label of ["Card code", "Artist", "Note", "Markers", "Channels"]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole("checkbox", { name: "Code not announced yet" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Pick a set" })).toBeDisabled();
  });

  it("leaves the fields editable otherwise", () => {
    render(<CreationPanel draft={draft} onChange={vi.fn()} layout="steps" />);

    expect(screen.getByRole("textbox", { name: /Card code/u })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /Note/u })).toBeEnabled();
  });
});
