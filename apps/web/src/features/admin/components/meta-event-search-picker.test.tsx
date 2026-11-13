import type { AdminMetaEvent } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = { events: [] as AdminMetaEvent[], isPending: false };

vi.mock("@/features/admin/hooks/use-admin-meta", () => ({
  useAdminMetaEventSearch: () => ({
    data: { events: captured.events },
    isPending: captured.isPending,
  }),
}));

const { MetaEventSearchPicker } =
  await import("@/features/admin/components/meta-event-search-picker");

function event(overrides: Partial<AdminMetaEvent> = {}): AdminMetaEvent {
  return {
    id: "e1",
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    eventDate: "2026-08-30",
    format: "constructed",
    playerCount: 64,
    organizer: "LGS Berlin",
    notes: null,
    tier: "local",
    country: "DE",
    location: null,
    playerRowCount: 64,
    deckCount: 8,
    results: "final",
    sources: [],
    ...overrides,
  };
}

describe("MetaEventSearchPicker", () => {
  beforeEach(() => {
    captured.isPending = false;
  });

  it("offers whatever the search returns, ranked or not", async () => {
    captured.events = [event(), event({ id: "e2", name: "Piltover Open" })];

    render(<MetaEventSearchPicker onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "sum");

    expect(await screen.findByRole("option", { name: /Summoner Skirmish/u })).toBeVisible();
    expect(screen.getByRole("option", { name: /Piltover Open/u })).toBeVisible();
  });

  it("leads each option with its date", async () => {
    captured.events = [event()];

    render(<MetaEventSearchPicker onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "sum");

    const option = await screen.findByRole("option", { name: /Summoner Skirmish/u });
    expect(option.textContent).toMatch(/^\S*2026\S*\s*Summoner Skirmish/u);
  });

  it("picks the event that is selected", async () => {
    captured.events = [event()];
    const onPick = vi.fn();

    render(<MetaEventSearchPicker onPick={onPick} />);
    await userEvent.type(screen.getByRole("combobox"), "sum");
    await userEvent.click(await screen.findByRole("option", { name: /Summoner Skirmish/u }));

    expect(onPick).toHaveBeenCalledWith("e1", "Summoner Skirmish");
  });

  it("shows nothing matched only once the search actually missed", async () => {
    captured.events = [];

    render(<MetaEventSearchPicker onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");

    expect(await screen.findByText("No matching events")).toBeVisible();
  });

  it("picks an event with the arrow keys", async () => {
    captured.events = [event(), event({ id: "e2", name: "Piltover Open" })];
    const onPick = vi.fn();

    render(<MetaEventSearchPicker onPick={onPick} />);
    await userEvent.type(screen.getByRole("combobox"), "pil");
    await screen.findByRole("option", { name: /Piltover Open/u });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith("e2", "Piltover Open");
  });

  it("shows no result list while the search runs", async () => {
    captured.events = [];
    captured.isPending = true;

    render(<MetaEventSearchPicker onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");

    expect(screen.queryByText("No matching events")).not.toBeInTheDocument();
  });

  it("keeps the picked name in the input with a clear button", async () => {
    captured.events = [event()];
    const user = userEvent.setup();

    const { container } = render(<MetaEventSearchPicker onPick={vi.fn()} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "sum");
    await user.click(await screen.findByRole("option", { name: /Summoner Skirmish/u }));

    expect(input).toHaveValue("Summoner Skirmish");
    const clear = container.querySelector<HTMLElement>("[data-slot=combobox-clear]");
    expect(clear).not.toBeNull();
    await user.click(clear as HTMLElement);
    expect(input).toHaveValue("");
  });

  it("announces the running search", async () => {
    captured.events = [];
    captured.isPending = true;

    render(<MetaEventSearchPicker onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "sum");

    expect(await screen.findByText("Searching…")).toHaveClass("sr-only");
  });
});
