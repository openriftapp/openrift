import { readFileSync } from "node:fs";

const BUILD_ID_FILE = "/app/.build-id";

/**
 * The deploy's short commit hash: `BUILD_ID`, else the file the Dockerfile writes. The web build
 * bakes the same hash in as `__COMMIT_HASH__`. Undefined outside a container.
 */
export function readBuildId(
  env: Record<string, string | undefined>,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf-8"),
): string | undefined {
  if (env.BUILD_ID) {
    return env.BUILD_ID;
  }
  try {
    return readFile(BUILD_ID_FILE).trim() || undefined;
  } catch {
    return undefined;
  }
}
