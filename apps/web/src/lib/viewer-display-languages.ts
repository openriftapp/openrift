// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";

import { viewerDisplayLanguages } from "@/lib/display-languages-cookie";
import { readInitFromServerCache } from "@/lib/init-queries";
import { hasSessionCookie } from "@/lib/session-cookie";

/** The signed-in viewer's display languages for this request, or null to render the defaults. */
export async function readViewerDisplayLanguages(): Promise<readonly string[] | null> {
  const cookieHeader = getRequest().headers.get("cookie");
  if (!hasSessionCookie(cookieHeader)) {
    return null;
  }
  const init = await readInitFromServerCache().catch(() => null);
  if (init === null) {
    return null;
  }
  const knownCodes = new Set((init.enums.languages ?? []).map((row) => row.slug));
  return viewerDisplayLanguages(cookieHeader, knownCodes);
}
