// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { isOfficialHostname } from "./official-host";

export const NOINDEX_ROBOTS_TXT = "User-agent: *\nAllow: /\n";

export function isIndexableRequest(request: Request): boolean {
  return isOfficialHostname(new URL(request.url).hostname);
}

export function withNoindex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
