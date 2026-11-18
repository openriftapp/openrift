// TanStack Start 1.167+ encodes server-fn POST bodies via seroval's
// `toJSONAsync` output ({ t: { t: 10, p: { k, v } }, ... }, scalars as
// { t: 0|1|2, s }). Tests don't pull in seroval, so decode just enough to
// reach ordinary objects/arrays/primitives back out of the AST.

interface SerovalEnvelope {
  t: SerovalNode;
}

interface SerovalNode {
  t: number;
  s?: unknown;
  p?: { k: string[]; v: SerovalNode[] };
  l?: number;
  a?: SerovalNode[];
}

function decodeSerovalNode(node: SerovalNode): unknown {
  // t=0 number, t=1 string, t=2 bool (s=2 true, s=3 false), t=3 null, t=4 undefined.
  switch (node.t) {
    case 0: {
      return node.s;
    }
    case 1: {
      return node.s;
    }
    case 2: {
      return node.s === 2;
    }
    case 3: {
      return null;
    }
    case 4: {
      return undefined;
    }
    case 9: {
      return (node.a ?? []).map((entry) => decodeSerovalNode(entry));
    }
    case 10: {
      const out: Record<string, unknown> = {};
      const p = node.p;
      if (p) {
        for (const [index, key] of p.k.entries()) {
          const child = p.v[index];
          if (child !== undefined) {
            out[key] = decodeSerovalNode(child);
          }
        }
      }
      return out;
    }
    default: {
      return undefined;
    }
  }
}

export function decodeServerFnData<T = unknown>(rawBody: unknown): T {
  const envelope = rawBody as SerovalEnvelope | { data: unknown } | undefined;
  if (envelope && typeof envelope === "object" && "t" in envelope && envelope.t) {
    const decoded = decodeSerovalNode(envelope.t) as { data?: T } | undefined;
    return (decoded?.data ?? {}) as T;
  }
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return (envelope as { data: T }).data ?? ({} as T);
  }
  return {} as T;
}

const SERVER_FN_ID = /\/_serverFn\/(?<id>[^/?#]+)/u;
// Mirrors ID_PATTERN in apps/web/src/lib/server-fn-id.ts; keep the two in sync.
const BUILD_ID = /^(?<name>[A-Za-z_$][\w$]*)\.[0-9a-f]{16}(?:_\d+)?$/u;
const HANDLER_SUFFIX = /_createServerFn_handler$/u;

function devServerFnName(id: string): string | undefined {
  try {
    const decoded = JSON.parse(Buffer.from(id, "base64url").toString("utf-8")) as {
      export?: unknown;
    };
    return typeof decoded.export === "string"
      ? decoded.export.replace(HANDLER_SUFFIX, "")
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether `url` calls the server function declared as `fnName`. Builds name it
 * `<name>.<digest>`; the dev server sends base64url JSON carrying the export name.
 */
export function isServerFn(url: string, fnName: string): boolean {
  const id = SERVER_FN_ID.exec(url)?.groups?.id;
  if (id === undefined) {
    return false;
  }
  const name = BUILD_ID.exec(id)?.groups?.name ?? devServerFnName(id);
  return name === fnName;
}
