import { vi } from "vitest";

import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";

interface HeadOutput {
  meta: Record<string, string>[];
  links?: Record<string, string>[];
  scripts?: { children?: string }[];
}

interface RouteLike {
  options: { loader?: unknown; head?: unknown };
}

type LoaderFn = (ctx: unknown) => Promise<unknown>;
type HeadFn = (ctx: { loaderData: unknown; params: Record<string, string> }) => HeadOutput;

const ROUTE_HEAD_INIT = {
  enums: {
    deckFormats: [
      { slug: "constructed", label: "Constructed", sortOrder: 0 },
      { slug: "custom-region", label: "Custom Region", sortOrder: 1 },
    ],
  },
};

function stubQueryClient(payload: unknown) {
  const flagsKey = JSON.stringify(featureFlagsQueryOptions.queryKey);
  const setsKey = JSON.stringify(publicSetListQueryOptions.queryKey);
  const initKey = JSON.stringify(initQueryOptions.queryKey);
  return {
    query: vi.fn((options: { queryKey: readonly unknown[] }) => {
      const key = JSON.stringify(options.queryKey);
      if (key === flagsKey) {
        return Promise.resolve({ "board-states": true });
      }
      if (key === setsKey) {
        return Promise.resolve({ sets: [] });
      }
      if (key === initKey) {
        return Promise.resolve(ROUTE_HEAD_INIT);
      }
      return Promise.resolve(payload);
    }),
  };
}

export function runRouteLoader(
  route: RouteLike,
  params: Record<string, string>,
  payload: unknown,
): Promise<unknown> {
  return (route.options.loader as LoaderFn)({
    context: { queryClient: stubQueryClient(payload) },
    params,
    deps: {},
    location: { search: {}, hash: "" },
  });
}

export function runRouteHead(
  route: RouteLike,
  params: Record<string, string>,
  loaderData: unknown,
): HeadOutput {
  return (route.options.head as HeadFn)({ loaderData, params });
}

export async function loadedHead(
  route: RouteLike,
  params: Record<string, string>,
  payload: unknown,
): Promise<HeadOutput> {
  return runRouteHead(route, params, await runRouteLoader(route, params, payload));
}

export function headTitle(head: HeadOutput): string | undefined {
  return head.meta.find((entry) => entry.title !== undefined)?.title;
}

export function headMeta(head: HeadOutput, key: string): string | undefined {
  return head.meta.find((entry) => entry.name === key || entry.property === key)?.content;
}

export function headCanonical(head: HeadOutput): string | undefined {
  return head.links?.find((entry) => entry.rel === "canonical")?.href;
}

export function headJsonLd(head: HeadOutput): unknown[] {
  return (head.scripts ?? []).map((script) => JSON.parse(script.children ?? "null"));
}
