// oxlint-disable-next-line no-restricted-imports -- the document enumerates every contract, so the barrel is the point here; apps/api runs unbundled on Bun.
import * as contracts from "@openrift/shared/contracts";
import type { AnyContractRouter } from "@orpc/contract";
import type { OpenAPI } from "@orpc/openapi";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

// This is the only OpenAPI document the API produces. A few plain Hono
// endpoints (health, Sentry tunnel, share/list image generators, email
// unsubscribe) don't serve typed JSON and are excluded on purpose.

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

/**
 * Collects every `*Contract` export from the shared contracts barrel into one
 * router object; keys are arbitrary since the OpenAPI path comes from each
 * procedure's `.route({ path })`.
 */
function buildContractRouter(): AnyContractRouter {
  const router: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(contracts)) {
    if (key.endsWith("Contract")) {
      router[key] = value;
    }
  }
  return router as AnyContractRouter;
}

type AuthLevel = "public" | "bearer" | undefined;

interface ContractMeta {
  auth?: AuthLevel;
  developerApi?: boolean;
}

interface ContractDef {
  route?: { method?: string; path?: string };
  meta?: ContractMeta;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

/** Records each operation's contract `meta`, keyed by `"METHOD /path"`. */
function collectMetaByOperation(node: unknown, out: Map<string, ContractMeta>): void {
  if (!node || typeof node !== "object") {
    return;
  }
  const def = (node as { "~orpc"?: ContractDef })["~orpc"];
  if (def?.route?.method && def.route.path) {
    out.set(`${def.route.method} ${def.route.path}`, def.meta ?? {});
    return;
  }
  for (const value of Object.values(node)) {
    collectMetaByOperation(value, out);
  }
}

// Admin operations aren't gated by contract meta; they're gated by the
// requireAdmin Hono middleware on the /api/admin/v1/* prefix (see app.ts).
// Stamp the admin security marker by path instead, mirroring that mount.
const ADMIN_PATH_PREFIX = "/api/admin/";

/**
 * Sets each operation's OpenAPI `security`: cookieAuth by default
 * (fail-closed), `[]` for public reads, `bearerAuth` for the provider push,
 * `adminAuth` for the admin path prefix.
 */
function applySecurity(doc: OpenAPI.Document, metaByOperation: Map<string, ContractMeta>): void {
  doc.security = [{ cookieAuth: [] }];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = (item as Record<string, { security?: unknown } | undefined>)[method];
      if (!operation) {
        continue;
      }
      const auth = metaByOperation.get(`${method.toUpperCase()} ${path}`)?.auth;
      if (path.startsWith(ADMIN_PATH_PREFIX)) {
        operation.security = [{ adminAuth: [] }];
      } else if (auth === "public") {
        operation.security = [];
      } else if (auth === "bearer") {
        operation.security = [{ bearerAuth: [] }];
      }
      // Otherwise the operation inherits the document-level cookieAuth default.
    }
  }
}

interface ContractDocument {
  doc: OpenAPI.Document;
  metaByOperation: Map<string, ContractMeta>;
}

// Static for a given build; reused across requests to every doc endpoint.
let cachedContractDoc: Promise<ContractDocument> | null = null;

function generateContractDocument(): Promise<ContractDocument> {
  cachedContractDoc ??= (async () => {
    const router = buildContractRouter();
    const metaByOperation = new Map<string, ContractMeta>();
    collectMetaByOperation(router, metaByOperation);
    const doc = await generator.generate(router);
    applySecurity(doc, metaByOperation);
    return { doc, metaByOperation };
  })();
  return cachedContractDoc;
}

export async function generateContractOpenAPIDocument(): Promise<OpenAPI.Document> {
  const { doc } = await generateContractDocument();
  return doc;
}

export async function generateDeveloperOpenAPIDocument(): Promise<OpenAPI.Document> {
  const { doc, metaByOperation } = await generateContractDocument();
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const operations = Object.entries(item ?? {}).filter(
      ([method]) =>
        (HTTP_METHODS as readonly string[]).includes(method) &&
        metaByOperation.get(`${method.toUpperCase()} ${path}`)?.developerApi,
    );
    if (operations.length > 0) {
      paths[path] = Object.fromEntries(operations);
    }
  }
  return { ...doc, paths: paths as OpenAPI.PathsObject };
}
