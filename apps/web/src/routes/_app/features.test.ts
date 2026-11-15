import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const summary = vi.hoisted(() => ({ fail: false, calls: 0 }));

vi.mock("@/features/marketing/lib/landing-summary-queries", () => ({
  landingSummaryQueryOptions: {
    queryKey: ["landing-summary"],
    queryFn: () => {
      summary.calls++;
      return summary.fail ? Promise.reject(new Error("down")) : Promise.resolve({ cards: [] });
    },
    retry: false,
  },
}));

const { Route } = await import("./features");

type FeaturesLoader = (args: { context: { queryClient: QueryClient } }) => Promise<void>;

function runLoader(queryClient: QueryClient): Promise<void> {
  return (Route.options.loader as unknown as FeaturesLoader)({ context: { queryClient } });
}

describe("/features loader", () => {
  it("prefetches the landing summary the vignettes draw their art from", async () => {
    summary.fail = false;
    const queryClient = new QueryClient();
    await runLoader(queryClient);
    expect(queryClient.getQueryData(["landing-summary"])).toEqual({ cards: [] });
  });

  it("still loads the page when the summary is down", async () => {
    summary.fail = true;
    await expect(runLoader(new QueryClient())).resolves.toBeUndefined();
  });
});
