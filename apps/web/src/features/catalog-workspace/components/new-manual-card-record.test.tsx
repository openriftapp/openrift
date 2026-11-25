import { labelMapOf } from "@openrift/shared/enum-label";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createCard: vi.fn(),
  createPrinting: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="/card">{children}</a>,
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useCreateCard: () => ({ mutateAsync: mocks.createCard, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useCreateDeskPrinting: () => ({ mutateAsync: mocks.createPrinting, isPending: false }),
}));
vi.mock("@/features/catalog-workspace/hooks/use-printing-creation", () => ({
  useCreationFollowUps: () => ({ finish: () => Promise.resolve(null), pending: false }),
}));
vi.mock("@/features/admin/lib/admin-card-queries", () => ({
  adminCardDetailQueryOptions: (cardSlug: string) => ({
    queryKey: ["admin", "cards", "detail", cardSlug],
    queryFn: () => ({ card: { id: "card-1" } }),
  }),
}));
vi.mock("@/features/catalog-workspace/hooks/use-register-record-actions", () => ({
  useRegisterRecordActions: () => {},
}));
vi.mock("@/features/catalog-workspace/components/creation/creation-panel", () => ({
  CreationPanel: () => null,
}));
vi.mock("@/features/catalog-workspace/lib/creation-draft", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  validateDraft: () => [],
  plannedImageUploads: () => [],
  toDeskCreateInput: () => ({}),
}));
vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["en"],
}));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: { user: { name: "Teemo" } } }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: {
      finishes: ["normal"],
      cardSizes: ["standard"],
      cardTypes: ["unit"],
      domains: ["fury"],
      superTypes: [],
    },
    labels: {
      cardTypes: labelMapOf({ unit: "Unit" }),
      domains: labelMapOf({ fury: "Fury" }),
      superTypes: labelMapOf({}),
    },
  }),
}));

const { NewManualCardRecord } = await import("./new-manual-card-record");
const { resetWorkspaceWriteQueue, workspaceWriteQueue } =
  await import("@/features/catalog-workspace/lib/workspace-write-queue");

function renderRecord() {
  const client = new QueryClient();
  return render(<NewManualCardRecord />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("NewManualCardRecord", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.createCard.mockReset();
    mocks.createPrinting.mockReset();
    resetWorkspaceWriteQueue();
  });

  it("holds Create once clicked while an earlier write is still queued", async () => {
    const user = userEvent.setup();
    void workspaceWriteQueue().enqueue(Symbol("earlier"), () => new Promise(() => {}), {
      queryClient: new QueryClient(),
    });
    renderRecord();

    await user.type(screen.getByLabelText("Name *"), "Jinx, Rebel");
    await user.click(screen.getByRole("button", { name: "Unit" }));
    await user.click(screen.getByRole("button", { name: "Fury" }));
    await user.click(screen.getByRole("button", { name: "Create card" }));

    expect(screen.getByRole("button", { name: "Create card" })).toBeDisabled();
  });

  it("stays on the record and says why the first printing failed", async () => {
    const user = userEvent.setup();
    mocks.createCard.mockResolvedValue({ cardSlug: "jinx-rebel" });
    mocks.createPrinting.mockRejectedValue(new Error("Short code already taken"));
    renderRecord();

    await user.type(screen.getByLabelText("Name *"), "Jinx, Rebel");
    await user.click(screen.getByRole("button", { name: "Unit" }));
    await user.click(screen.getByRole("button", { name: "Fury" }));
    await user.click(screen.getByRole("button", { name: "Create card" }));

    expect(
      await screen.findByText(
        "The card was created, but its printing was not: Short code already taken",
      ),
    ).toBeVisible();
    expect(screen.getByText("Open the card")).toBeVisible();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("names a lost connection as the reason, not the browser's fetch error", async () => {
    const user = userEvent.setup();
    mocks.createCard.mockResolvedValue({ cardSlug: "jinx-rebel" });
    mocks.createPrinting.mockRejectedValue(new TypeError("Failed to fetch"));
    renderRecord();

    await user.type(screen.getByLabelText("Name *"), "Jinx, Rebel");
    await user.click(screen.getByRole("button", { name: "Unit" }));
    await user.click(screen.getByRole("button", { name: "Fury" }));
    await user.click(screen.getByRole("button", { name: "Create card" }));

    expect(
      await screen.findByText(
        "The card was created, but its printing was not: Can't reach the server. Check your connection.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Open the card")).toBeVisible();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("marks a stat that is not a whole number and holds Create", async () => {
    const user = userEvent.setup();
    renderRecord();

    await user.type(screen.getByLabelText("Name *"), "Jinx, Rebel");
    await user.click(screen.getByRole("button", { name: "Unit" }));
    await user.click(screen.getByRole("button", { name: "Fury" }));
    await user.type(screen.getByLabelText("Might"), "1.5");

    expect(screen.getByText("Whole number")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create card" })).toHaveProperty("disabled", true);
  });

  it("locks every card field while the create runs", async () => {
    const user = userEvent.setup();
    mocks.createCard.mockReturnValue(new Promise(() => {}));
    renderRecord();

    await user.type(screen.getByLabelText("Name *"), "Jinx, Rebel");
    await user.click(screen.getByRole("button", { name: "Unit" }));
    await user.click(screen.getByRole("button", { name: "Fury" }));
    await user.click(screen.getByRole("button", { name: "Create card" }));

    await waitFor(() => expect(screen.getByLabelText("Name *")).toBeDisabled());
    expect(screen.getByLabelText("Card ID *")).toBeDisabled();
    expect(screen.getByLabelText("Might")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fury" })).toBeDisabled();
  });
});
