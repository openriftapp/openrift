import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route as LoginRoute } from "./login";
import { Route as SignupRoute } from "./signup";

type Hook = (ctx: Record<string, unknown>) => Promise<unknown>;
type Validate = (search: Record<string, unknown>) => { redirect?: string };

function clientWith(session: unknown): QueryClient {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["session"], session);
  return queryClient;
}

describe.each([
  ["/login", LoginRoute],
  ["/signup", SignupRoute],
])("%s for a signed-in visitor", (_path, route) => {
  const gate = route.options.beforeLoad as unknown as Hook;
  const validate = route.options.validateSearch as unknown as Validate;

  async function run(session: unknown, rawSearch: Record<string, unknown> = {}) {
    const search = validate(rawSearch);
    return gate({ context: { queryClient: clientWith(session) }, search }).catch(
      (error: unknown) => error,
    );
  }

  it("goes on to the requested page", async () => {
    const thrown = await run({ user: { id: "user-1" } }, { redirect: "/decks?tab=mine" });

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { href: "/decks?tab=mine", replace: true } });
  });

  it("goes to the collections without a requested page", async () => {
    const thrown = await run({ user: { id: "user-1" } });

    expect(thrown).toMatchObject({ options: { href: "/collections" } });
  });

  it("ignores a requested page on another site", async () => {
    const thrown = await run({ user: { id: "user-1" } }, { redirect: "https://example.com/" });

    expect(thrown).toMatchObject({ options: { href: "/collections" } });
  });

  it("shows the form to a signed-out visitor", async () => {
    await expect(run(null, { redirect: "/decks" })).resolves.toBeUndefined();
  });

  it("shows the form when the session cannot be loaded", async () => {
    const queryClient = { query: () => Promise.reject(new Error("offline")) };

    await expect(gate({ context: { queryClient }, search: validate({}) })).resolves.toBeUndefined();
  });
});
