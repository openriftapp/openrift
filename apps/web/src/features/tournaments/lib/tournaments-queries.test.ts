import { beforeEach, describe, expect, it, vi } from "vitest";

const VIEWER_COOKIE = "session=viewer";

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: { name: "withCookies" } }));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const { withCookies } = await import("@/lib/server-fns/middleware");
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    createServerFn: () => {
      let forwardsCookies = false;
      const chain = {
        validator: () => chain,
        middleware: (list: unknown[]) => {
          forwardsCookies = list.includes(withCookies);
          return chain;
        },
        handler: (fn: (input: Record<string, unknown>) => unknown) => (input: { data: unknown }) =>
          fn({ context: forwardsCookies ? { cookie: VIEWER_COOKIE } : {}, data: input.data }),
      };
      return chain;
    },
  };
});

const clientCookies: (string | undefined)[] = [];
const landing = vi.fn();
const staffInviteLanding = vi.fn();

vi.mock("@/lib/server-fns/orpc-client", () => ({
  apiOrpcClient: (_contract: unknown, cookie?: string) => {
    clientCookies.push(cookie);
    return { landing, staffInviteLanding };
  },
}));

const {
  tournamentClaimLandingQueryOptions,
  tournamentStaffInviteLandingQueryOptions,
  tournamentSubmitLandingQueryOptions,
} = await import("./tournaments-queries");

beforeEach(() => {
  clientCookies.length = 0;
  landing.mockResolvedValue({});
  staffInviteLanding.mockResolvedValue({});
});

describe("token landing fetches", () => {
  it.each([
    ["submit", tournamentSubmitLandingQueryOptions],
    ["staff invite", tournamentStaffInviteLandingQueryOptions],
    ["deck claim", tournamentClaimLandingQueryOptions],
  ])("asks the API for the %s landing as the viewer", async (_name, options) => {
    const queryFn = options("token-1").queryFn as () => Promise<unknown>;
    await queryFn();
    expect(clientCookies).toEqual([VIEWER_COOKIE]);
  });
});
