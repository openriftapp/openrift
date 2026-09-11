import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/account/lib/auth-client", () => ({
  authClient: { updateUser: vi.fn() },
}));

const { PublicProfileSection } = await import("./public-profile-section");
const { authClient } = await import("@/features/account/lib/auth-client");
const updateUser = vi.mocked(authClient.updateUser);

function renderSection(
  overrides: Partial<Parameters<typeof PublicProfileSection>[0]["values"]> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicProfileSection
        userId="user-1"
        values={{
          bio: null,
          profileShowRiotId: false,
          profileShowCollection: false,
          profileShowLastActive: true,
          ...overrides,
        }}
      />
    </QueryClientProvider>,
  );
}

describe("PublicProfileSection", () => {
  beforeEach(() => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({ data: { status: true }, error: null } as never);
  });

  it("saves a typed bio and confirms", async () => {
    const user = userEvent.setup();
    renderSection();

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Bio"), "Fury and Chaos player.");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ bio: "Fury and Chaos player." }));
    expect(await screen.findByText("Bio updated.")).toBeInTheDocument();
  });

  it("shows the server's reason when the bio is rejected", async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue({
      data: null,
      error: { message: "Keep the bio short.", code: "INVALID_BIO", status: 400 },
    } as never);
    renderSection();

    await user.type(screen.getByLabelText("Bio"), "Too long");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Keep the bio short.")).toBeInTheDocument();
  });

  it("reflects the stored toggles and saves a change", async () => {
    const user = userEvent.setup();
    renderSection({ profileShowRiotId: true });

    expect(screen.getByRole("switch", { name: "Show my Riot ID" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Show my collection size" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Show when I was last active" })).toBeChecked();

    await user.click(screen.getByRole("switch", { name: "Show my collection size" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ profileShowCollection: true }));
  });

  it("reports a failed toggle save without changing the stored state", async () => {
    const user = userEvent.setup();
    updateUser.mockRejectedValue(new Error("offline"));
    renderSection();

    await user.click(screen.getByRole("switch", { name: "Show my Riot ID" }));

    expect(await screen.findByText("Could not save. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show my Riot ID" })).not.toBeChecked();
  });
});
