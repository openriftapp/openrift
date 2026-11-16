import { describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("null", { headers: { "Content-Type": "application/json" } }),
  ),
}));

vi.mock("@/lib/api-fetch", () => ({ apiFetch }));
vi.stubEnv("API_INTERNAL_URL", "http://api.test");

const { authClient } = await import("./auth-client");

describe("authClient", () => {
  it("sends its requests through apiFetch so a newer deploy is noticed", async () => {
    await authClient.getSession();

    expect(apiFetch).toHaveBeenCalledOnce();
    const input = apiFetch.mock.calls[0]?.[0];
    const url = input instanceof Request ? input.url : input?.toString();
    expect(url).toContain("/get-session");
  });
});
