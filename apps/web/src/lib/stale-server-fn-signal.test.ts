import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  isStartMissingServerFnError,
  START_MISSING_SERVER_FN_PATTERN,
} from "./stale-server-fn-signal";

type GenerateResolver = (opts: {
  serverFnsById: Record<string, unknown>;
  includeClientReferencedCheck: boolean;
}) => string;
type GetServerFnById = (id: string, access: { origin: string }) => Promise<unknown>;

/**
 * The generator is not in start-plugin-core's exports map, so it is loaded by file path
 * from the copy @tanstack/react-start depends on.
 */
async function installedResolverGenerator(): Promise<GenerateResolver> {
  const startRequire = createRequire(
    createRequire(import.meta.url).resolve("@tanstack/react-start/package.json"),
  );
  const pluginRoot = path.dirname(startRequire.resolve("@tanstack/start-plugin-core/package.json"));
  const modulePath = path.join(pluginRoot, "dist/esm/start-compiler/server-fn-resolver-module.js");
  const module = (await import(pathToFileURL(modulePath).href)) as {
    generateServerFnResolverModule: GenerateResolver;
  };
  return module.generateServerFnResolverModule;
}

async function resolverFor(serverFnsById: Record<string, unknown>): Promise<GetServerFnById> {
  const generate = await installedResolverGenerator();
  const dir = await mkdtemp(path.join(tmpdir(), "start-resolver-"));
  const file = path.join(dir, "resolver.mjs");
  await writeFile(file, generate({ serverFnsById, includeClientReferencedCheck: true }));
  const module = (await import(pathToFileURL(file).href)) as { getServerFnById: GetServerFnById };
  await rm(dir, { recursive: true });
  return module.getServerFnById;
}

describe("the installed Start resolver's missing-id error", () => {
  it("is recognised by the stale-server-function matcher", async () => {
    const getServerFnById = await resolverFor({});
    const error: unknown = await getServerFnById("deadbeef", { origin: "client" }).catch(
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(Error);
    expect(isStartMissingServerFnError(error)).toBe(true);
  });
});

describe("isStartMissingServerFnError", () => {
  it("leaves the resolver's other errors and unrelated errors alone", () => {
    expect(
      isStartMissingServerFnError(
        new Error("Server function module export not resolved for serverFn ID: abc"),
      ),
    ).toBe(false);
    expect(
      isStartMissingServerFnError(new Error("Server function not accessible from client: abc")),
    ).toBe(false);
    expect(isStartMissingServerFnError(new Error("Internal server error"))).toBe(false);
    expect(isStartMissingServerFnError("Server function info not found for abc")).toBe(false);
  });

  it("matches the module-not-resolved wording", () => {
    expect(
      START_MISSING_SERVER_FN_PATTERN.test("Server function module not resolved for abc"),
    ).toBe(true);
  });
});
