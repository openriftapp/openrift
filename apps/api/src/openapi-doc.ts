// oxlint-disable-next-line no-restricted-imports -- the document enumerates every contract, so the barrel is the point here; apps/api runs unbundled on Bun.
import * as contracts from "@openrift/shared/contracts";
import {
  catalogCardResponseValueSchema,
  catalogPrintingResponseValueSchema,
  catalogPrintingSide2Schema,
} from "@openrift/shared/contracts/catalog";
import { marketplaceLinkSchema } from "@openrift/shared/contracts/prices";
import { ruleResponseSchema, ruleVersionResponseSchema } from "@openrift/shared/contracts/rules";
import {
  catalogCardResponseSchema,
  catalogSetResponseSchema,
  distributionChannelSchema,
  markerSchema,
} from "@openrift/shared/response-schemas";
import type { AnyContractRouter } from "@orpc/contract";
import type { OpenAPI } from "@orpc/openapi";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

// These are the only OpenAPI documents the API produces. A few plain Hono
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

export function developerOperations(): string[] {
  const metaByOperation = new Map<string, ContractMeta>();
  collectMetaByOperation(buildContractRouter(), metaByOperation);
  return [...metaByOperation.entries()]
    .filter(([, meta]) => meta.developerApi)
    .map(([operation]) => operation);
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

const COMMON_SCHEMAS = {
  Card: { schema: catalogCardResponseSchema, strategy: "output" },
  CatalogCard: { schema: catalogCardResponseValueSchema, strategy: "output" },
  Printing: { schema: catalogPrintingResponseValueSchema, strategy: "output" },
  PrintingSide: { schema: catalogPrintingSide2Schema, strategy: "output" },
  Set: { schema: catalogSetResponseSchema, strategy: "output" },
  Marker: { schema: markerSchema, strategy: "output" },
  DistributionChannel: { schema: distributionChannelSchema, strategy: "output" },
  MarketplaceLink: { schema: marketplaceLinkSchema, strategy: "output" },
  Rule: { schema: ruleResponseSchema, strategy: "output" },
  RuleVersion: { schema: ruleVersionResponseSchema, strategy: "output" },
  Error: { error: "UndefinedError" },
} as const;

const ERROR_SCHEMA_REF = "#/components/schemas/Error";

/** ADR-037 keeps `type` as `types[0]`; the zod converter has no deprecation channel, so it is stamped here. */
function markDeprecatedCardType(doc: OpenAPI.Document): void {
  for (const name of ["Card", "CatalogCard"]) {
    const schema = doc.components?.schemas?.[name] as
      | { properties?: Record<string, Record<string, unknown>> }
      | undefined;
    const type = schema?.properties?.type;
    if (type) {
      type.deprecated = true;
      type.description = "Always `types[0]`. Read `types`; a card can have more than one type.";
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
    const doc = await generator.generate(router, { commonSchemas: COMMON_SCHEMAS });
    applySecurity(doc, metaByOperation);
    markDeprecatedCardType(doc);
    return { doc, metaByOperation };
  })();
  return cachedContractDoc;
}

interface DocInfo {
  title: string;
  version: string;
  description: string;
}

const publicDocInfo: DocInfo = {
  title: "OpenRift API",
  version: "1.0.0",
  description: [
    "**Authentication:** This API uses session cookies (Better Auth).",
    "Auth endpoints are not in this spec, they are proxied from `/api/auth/*`.",
    "Admin endpoints live in a separate spec at `/api/admin/doc`.",
    "",
    "To try authenticated endpoints in Swagger UI: sign in via the web app,",
    "then open this page on the API origin in the same browser.",
  ].join("\n"),
};

const adminDocInfo: DocInfo = {
  title: "OpenRift Admin API",
  version: "1.0.0",
  description: "Admin-only operations, mounted under `/api/admin/v1` (require an admin session).",
};

const developerDocInfo: DocInfo = {
  title: "OpenRift Developer API",
  version: "1.0.0",
  description: [
    "Free, public Riftbound card data. No key or sign-in needed.",
    "Send a `User-Agent` with your project's name and a way to reach you.",
    "",
    "Every error is `{ defined, code, status, message, data }`. A rejected",
    "input is a `400` whose `data.issues` lists each field as `{ path, message }`.",
    "",
    "Guide, caching and terms: `/developers` on this site.",
  ].join("\n"),
};

const securitySchemes = {
  cookieAuth: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
  bearerAuth: { type: "http", scheme: "bearer" },
  adminAuth: {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description: "Session cookie of a user with the admin role.",
  },
} as const;

function filterPaths(doc: OpenAPI.Document, keep: (path: string) => boolean): OpenAPI.Document {
  return {
    ...doc,
    paths: Object.fromEntries(
      Object.entries(doc.paths ?? {}).filter(([path]) => keep(path)),
    ) as OpenAPI.PathsObject,
  };
}

async function buildSessionDoc(
  info: DocInfo,
  keep: (path: string) => boolean,
): Promise<OpenAPI.Document> {
  const { doc } = await generateContractDocument();
  return filterPaths(
    {
      ...doc,
      openapi: "3.1.0",
      info,
      components: {
        ...doc.components,
        securitySchemes: { ...doc.components?.securitySchemes, ...securitySchemes },
      },
    },
    keep,
  );
}

export function buildPublicDoc(): Promise<OpenAPI.Document> {
  return buildSessionDoc(publicDocInfo, (path) => !path.startsWith(ADMIN_PATH_PREFIX));
}

export function buildAdminDoc(): Promise<OpenAPI.Document> {
  return buildSessionDoc(adminDocInfo, (path) => path.startsWith(ADMIN_PATH_PREFIX));
}

type OperationObject = Record<string, unknown> & {
  parameters?: unknown[];
  responses?: Record<string, unknown>;
};

/** Every parameterised operation can reject its input; the generator only knows the contract's declared errors. */
function withBadRequestResponse(operation: OperationObject): OperationObject {
  if (!operation.parameters?.length || operation.responses?.["400"]) {
    return operation;
  }
  return {
    ...operation,
    responses: {
      ...operation.responses,
      400: {
        description:
          "Invalid input. `data.issues` lists each rejected field as `{ path, message }`.",
        content: { "application/json": { schema: { $ref: ERROR_SCHEMA_REF } } },
      },
    },
  };
}

export async function buildDeveloperDoc(serverUrl?: string): Promise<OpenAPI.Document> {
  const { doc, metaByOperation } = await generateContractDocument();
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const operations = Object.entries(item ?? {}).filter(
      ([method]) =>
        (HTTP_METHODS as readonly string[]).includes(method) &&
        metaByOperation.get(`${method.toUpperCase()} ${path}`)?.developerApi,
    );
    if (operations.length > 0) {
      paths[path] = Object.fromEntries(
        operations.map(([method, operation]) => [
          method,
          withBadRequestResponse(operation as OperationObject),
        ]),
      );
    }
  }
  return {
    ...doc,
    openapi: "3.1.0",
    info: developerDocInfo,
    ...(serverUrl === undefined ? {} : { servers: [{ url: serverUrl }] }),
    security: [],
    paths: paths as OpenAPI.PathsObject,
    components: { ...doc.components, securitySchemes: {} },
  };
}
