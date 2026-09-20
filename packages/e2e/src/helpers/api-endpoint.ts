import type { Request } from "@playwright/test";

// Browser-side oRPC calls go to the web origin under /api/v1, so match on the
// pathname; `{id}` stands for one path segment.
function pathPattern(pattern: string): RegExp {
  const escaped = pattern.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`^${escaped.replaceAll(String.raw`\{id\}`, "[^/]+")}$`, "u");
}

export function isApiPath(url: string | URL, pattern: string): boolean {
  return pathPattern(pattern).test(new URL(url).pathname);
}

export function isApiCall(request: Request, method: string, pattern: string): boolean {
  return request.method() === method && isApiPath(request.url(), pattern);
}
