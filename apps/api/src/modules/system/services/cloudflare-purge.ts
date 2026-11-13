import { chunk } from "@openrift/shared/collections";

import type { Io } from "../../../io.js";
import { DEFAULT_TIMEOUT_MS } from "../../../lib/http.js";
import type { Config } from "../../../types.js";

type CloudflareConfig = NonNullable<Config["cloudflare"]>;

const MAX_FILES_PER_PURGE = 30;

export function requestCloudflarePurge(
  cloudflare: CloudflareConfig,
  fetch: Io["fetch"],
  body: { purge_everything: true } | { files: string[] },
): Promise<Response> {
  return fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(cloudflare.zoneId)}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloudflare.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    },
  );
}

export async function purgeCloudflarePaths(
  cloudflare: CloudflareConfig,
  fetch: Io["fetch"],
  siteUrl: string,
  paths: readonly string[],
): Promise<number[]> {
  const files = [...new Set(paths)].map((path) => new URL(path, siteUrl).toString());
  const failures: number[] = [];
  for (const batch of chunk(files, MAX_FILES_PER_PURGE)) {
    const res = await requestCloudflarePurge(cloudflare, fetch, { files: batch });
    if (!res.ok) {
      failures.push(res.status);
    }
  }
  return failures;
}
