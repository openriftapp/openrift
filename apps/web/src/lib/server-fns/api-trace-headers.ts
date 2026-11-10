// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { context, propagation } from "@opentelemetry/api";

import { activeClientIp } from "./client-ip-context";

export function serverApiRequestHeaders(cookie?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) {
    headers.cookie = cookie;
  }
  propagation.inject(context.active(), headers);
  const clientIp = activeClientIp();
  if (clientIp !== undefined) {
    headers["x-real-ip"] = clientIp;
  }
  return headers;
}
