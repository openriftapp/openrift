import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { featureFlagsQueryOptions } from "@/lib/feature-flags";

import { requireScanner } from "./scanner-flag";

function clientWithFlags(flags: Record<string, boolean>): QueryClient {
  const queryClient = new QueryClient();
  queryClient.setQueryData(featureFlagsQueryOptions.queryKey, flags);
  return queryClient;
}

describe("requireScanner", () => {
  it("lets the route load while the scanner is available", async () => {
    await expect(requireScanner(clientWithFlags({ scanner: true }))).resolves.toBeUndefined();
  });

  it("redirects to the collections when the scanner is unavailable", async () => {
    const rejection = expect(requireScanner(clientWithFlags({ scanner: false }))).rejects;
    await rejection.toSatisfy((value: unknown) => isRedirect(value));
    await rejection.toMatchObject({ options: { to: "/collections" } });
  });

  it("redirects when the API sent no scanner flag", async () => {
    await expect(requireScanner(clientWithFlags({}))).rejects.toSatisfy((value: unknown) =>
      isRedirect(value),
    );
  });
});
