import { labelMapOf } from "@openrift/shared/enum-label";
import { fireEvent, render, screen } from "@testing-library/react";
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
const images = vi.hoisted(() => ({ props: [] as { disabled?: boolean; allowFiles?: boolean }[] }));

vi.mock("@/features/catalog-workspace/components/creation/creation-images", () => ({
  CreationImages: (props: { disabled?: boolean; allowFiles?: boolean }) => {
    images.props.push(props);
    return null;
  },
  CreationImagesSummary: () => null,
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

  it("locks the open Images editor once the create starts", () => {
    const { rerender } = render(<CreationPanel draft={draft} onChange={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1] as HTMLElement);
    rerender(<CreationPanel draft={draft} onChange={vi.fn()} disabled />);

    expect(images.props.at(-1)?.disabled).toBe(true);
  });

  it("leaves out the dates, the note and file drops when an admin saves those later", () => {
    render(<CreationPanel draft={draft} onChange={vi.fn()} layout="steps" followUps={false} />);

    expect(screen.queryByLabelText("Note")).toBeNull();
    expect(screen.queryByLabelText("Announced on")).toBeNull();
    expect(images.props.at(-1)?.allowFiles).toBe(false);
  });
});
