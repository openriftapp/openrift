import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (args: { context: { cookie: string }; data: unknown }) => unknown) =>
        (args?: { data?: unknown }) =>
          fn({ context: { cookie: "" }, data: args?.data }),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));

let currentUserId: string | null = null;
vi.mock("@/hooks/use-session", () => ({
  useUserId: () => currentUserId,
  useRequiredUserId: () => {
    if (!currentUserId) {
      throw new Error("useRequiredUserId() called without an authenticated session.");
    }
    return currentUserId;
  },
}));

const {
  useAddParticipant,
  useAddTournamentStaff,
  useClaimStaffInvite,
  useCreateTournament,
  useParticipantAction,
  useRequestJoinTournament,
  useUpdateParticipant,
  useUpdateTournament,
} = await import("./use-tournament-mutations");

function stubFetch(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json(payload))),
  );
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, invalidateSpy, wrapper: Wrapper };
}

beforeEach(() => {
  currentUserId = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Both hooks drive landing pages that live outside `_authenticated`
// (/tournaments/submit/$token and /tournaments/staff-invite/$token), so
// rendering them signed out is the normal case, not a programming error.
describe("useRequestJoinTournament", () => {
  it("renders for a signed-out visitor", () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useRequestJoinTournament(), { wrapper });

    expect(result.current.mutateAsync).toBeInstanceOf(Function);
  });

  it("refreshes only the landing when signed out", async () => {
    stubFetch({ alreadyJoined: false });
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useRequestJoinTournament(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ token: "tok" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy.mock.calls).toEqual([[{ queryKey: ["tournaments", "submit", "tok"] }]]);
  });

  it("invalidates the tournament list and the landing when signed in", async () => {
    currentUserId = "user-1";
    stubFetch({ alreadyJoined: false });
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useRequestJoinTournament(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ token: "tok" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tournaments", "user-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tournaments", "submit", "tok"] });
  });
});

describe("useClaimStaffInvite", () => {
  it("renders for a signed-out visitor", () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useClaimStaffInvite(), { wrapper });

    expect(result.current.mutateAsync).toBeInstanceOf(Function);
  });

  it("invalidates no user-scoped keys when signed out", async () => {
    stubFetch({ tournamentId: "t-1" });
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useClaimStaffInvite(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("tok");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("invalidates the list and the claimed tournament when signed in", async () => {
    currentUserId = "user-1";
    stubFetch({ tournamentId: "t-1" });
    const { invalidateSpy, wrapper } = setup();

    const { result } = renderHook(() => useClaimStaffInvite(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("tok");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tournaments", "user-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tournaments", "user-1", "t-1"] });
  });
});

describe("inline error meta", () => {
  async function metaAfterRun(run: () => Promise<unknown>, client: QueryClient) {
    await act(async () => {
      await run().catch(() => null);
    });
    return client.getMutationCache().getAll()[0]?.options.meta;
  }

  it("marks the form and dialog mutations for inline errors", async () => {
    currentUserId = "user-1";
    stubFetch({});
    const hooks: (() => { mutateAsync: (variables: never) => Promise<unknown> })[] = [
      () => useUpdateTournament(),
      () => useAddParticipant(),
      () => useUpdateParticipant(),
      () => useAddTournamentStaff(),
      () => useCreateTournament(),
      () => useRequestJoinTournament(),
      () => useClaimStaffInvite(),
    ];
    for (const hook of hooks) {
      const { client, wrapper } = setup();
      const { result } = renderHook(hook, { wrapper });
      const meta = await metaAfterRun(
        () => (result.current.mutateAsync as (v: unknown) => Promise<unknown>)({ id: "t-1" }),
        client,
      );
      expect(meta).toEqual({ inlineError: true });
    }
  });

  it("leaves page-button participant actions on the toast", async () => {
    currentUserId = "user-1";
    stubFetch({});
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useParticipantAction(), { wrapper });
    const meta = await metaAfterRun(
      () => result.current.mutateAsync({ id: "t-1", participantId: "p-1", action: "drop" }),
      client,
    );
    expect(meta).toEqual({ inlineError: false });
  });
});
