import { describe, expect, it } from "vitest";

import {
  chunkUrls,
  createManifestCache,
  createPlayriftboundClient,
  decodeJsString,
  extractManifest,
  isRunStopping,
  PlayriftboundBlockedError,
  PlayriftboundRefusedError,
  PlayriftboundUnavailableError,
} from "./playriftbound-client.js";

const BASE = "https://events.example.test";
const ASSETS = "https://assets.example.test/_next/";

function manifestChunk(ids: Record<string, string>): string {
  const operations = Object.entries(ids).map(([name, id]) => ({
    id,
    name,
    type: "query",
    body: `query ${name} { x }`,
  }));
  const json = JSON.stringify({
    format: "apollo-persisted-query-manifest",
    version: 1,
    operations,
  });
  // The bundle wraps it the way a bundler escapes a string literal.
  return `972560,(n,e,t)=>{e.exports=JSON.parse('${json.replaceAll("'", String.raw`\'`)}')}`;
}

interface Call {
  url: string;
  headers: Record<string, string>;
}

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (key === undefined) {
      return Promise.resolve(new Response("not found", { status: 404 }));
    }
    return Promise.resolve(routes[key]?.() ?? new Response("", { status: 500 }));
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const PAGE = `<script src="${ASSETS}static/chunks/app.js"></script>`;
const APP_CHUNK = `e.l("static/chunks/lazy.js")`;

function client(routes: Record<string, () => Response>, cache = createManifestCache()) {
  const fake = fakeFetch(routes);
  return {
    ...fake,
    client: createPlayriftboundClient({
      fetch: fake.fetch,
      baseUrl: BASE,
      cache,
      sleep: () => Promise.resolve(),
      random: () => 0,
      now: () => 0,
    }),
  };
}

describe("manifest discovery helpers", () => {
  it("decodes escaped string literal bodies", () => {
    expect(decodeJsString(String.raw`it\'s é\n\\`)).toBe("it's é\n\\");
  });

  it("reads operation ids by name out of a bundled manifest", () => {
    const ids = extractManifest(manifestChunk({ Search: "abc", Poll: "def" }));
    expect(ids).toEqual(
      new Map([
        ["Search", "abc"],
        ["Poll", "def"],
      ]),
    );
    expect(extractManifest("console.log(1)")).toBeNull();
  });

  it("follows chunks nested under route folders", () => {
    expect(chunkUrls(`"static/chunks/app/[locale]/events/page-abc.js"`, ASSETS)).toEqual([
      `${ASSETS}static/chunks/app/[locale]/events/page-abc.js`,
    ]);
  });

  it("finds absolute chunk URLs and relative chunk references", () => {
    expect(chunkUrls(PAGE, ASSETS)).toEqual([`${ASSETS}static/chunks/app.js`]);
    expect(chunkUrls(APP_CHUNK, ASSETS)).toEqual([`${ASSETS}static/chunks/lazy.js`]);
  });
});

describe("createPlayriftboundClient", () => {
  const routes = (gql: () => Response) => ({
    [`${BASE}/en-US/events`]: () => new Response(PAGE),
    [`${ASSETS}static/chunks/app.js`]: () => new Response(APP_CHUNK),
    [`${ASSETS}static/chunks/lazy.js`]: () => new Response(manifestChunk({ Search: "id-1" })),
    [`${BASE}/api/gql`]: gql,
  });

  it("discovers the manifest, then sends a persisted query with the required headers", async () => {
    const { client: c, calls } = client(
      routes(() => Response.json({ data: { competeTournamentSearch: { edges: [] } } })),
    );
    const data = await c.query<unknown>("Search", { sport: "rb" });
    expect(data).toEqual({ competeTournamentSearch: { edges: [] } });

    const gql = calls.at(-1);
    const url = new URL(gql?.url ?? "");
    expect(url.searchParams.get("operationName")).toBe("Search");
    expect(JSON.parse(url.searchParams.get("variables") ?? "")).toEqual({ sport: "rb" });
    expect(JSON.parse(url.searchParams.get("extensions") ?? "")).toEqual({
      persistedQuery: { version: 1, sha256Hash: "id-1" },
    });
    expect(gql?.headers["content-type"]).toBe("application/json");
    expect(gql?.headers["apollographql-client-name"]).not.toBe("");
    expect(gql?.headers["apollographql-client-version"]).not.toBe("");
    expect(c.requests).toBe(4);
  });

  it("reuses a cached manifest across clients", async () => {
    const cache = createManifestCache();
    const first = client(
      routes(() => Response.json({ data: {} })),
      cache,
    );
    await first.client.query("Search", {});
    const second = client(
      routes(() => Response.json({ data: {} })),
      cache,
    );
    await second.client.query("Search", {});
    expect(second.calls.map((call) => new URL(call.url).pathname)).toEqual(["/api/gql"]);
  });

  it("re-reads the manifest once when the source no longer knows the id", async () => {
    let answers = 0;
    const { client: c, calls } = client(
      routes(() => {
        answers++;
        return answers === 1
          ? Response.json({
              data: null,
              errors: [{ message: "x", extensions: { code: "PERSISTED_QUERY_NOT_IN_LIST" } }],
            })
          : Response.json({ data: { ok: true } });
      }),
    );
    await expect(c.query("Search", {})).resolves.toEqual({ ok: true });
    expect(calls.filter((call) => call.url.startsWith(`${BASE}/en-US/events`))).toHaveLength(2);
  });

  it("refuses an operation the manifest does not list", async () => {
    const { client: c } = client(routes(() => Response.json({ data: {} })));
    await expect(c.query("Missing", {})).rejects.toBeInstanceOf(PlayriftboundRefusedError);
  });

  it("tells a refused query, which stops the run, from a refused event", async () => {
    const shape = client(
      routes(() =>
        Response.json({
          data: null,
          errors: [{ message: "bad field", extensions: { classification: "ValidationError" } }],
        }),
      ),
    );
    await expect(shape.client.query("Search", {})).rejects.toMatchObject({ stopsRun: true });

    const event = client(
      routes(() =>
        Response.json({
          data: null,
          errors: [{ message: "Tournament not found", extensions: { errorType: "BAD_REQUEST" } }],
        }),
      ),
    );
    await expect(event.client.query("Search", {})).rejects.toMatchObject({ stopsRun: false });
  });

  it("reads GraphQL errors sent with a 400, including a stale query id", async () => {
    let answers = 0;
    const { client: c, calls } = client(
      routes(() => {
        answers++;
        return answers === 1
          ? Response.json(
              { errors: [{ extensions: { code: "PERSISTED_QUERY_NOT_IN_LIST" } }] },
              { status: 400 },
            )
          : Response.json({ data: { ok: true } });
      }),
    );
    await expect(c.query("Search", {})).resolves.toEqual({ ok: true });
    expect(calls.filter((call) => call.url.startsWith(`${BASE}/en-US/events`))).toHaveLength(2);
  });

  it("reads an HTML page where the API should answer JSON as a block", async () => {
    const { client: c } = client(routes(() => new Response("<html>challenge</html>")));
    await expect(c.query("Search", {})).rejects.toBeInstanceOf(PlayriftboundBlockedError);
    expect(c.blocked).toBe(true);
  });

  it("re-reads the query list for any persisted-query wording of a stale id", async () => {
    let answers = 0;
    const { client: c, calls } = client(
      routes(() => {
        answers++;
        return answers === 1
          ? Response.json({ data: null, errors: [{ message: "PersistedQueryNotFound" }] })
          : Response.json({ data: { ok: true } });
      }),
    );
    await expect(c.query("Search", {})).resolves.toEqual({ ok: true });
    expect(calls.filter((call) => call.url.startsWith(`${BASE}/en-US/events`))).toHaveLength(2);
  });

  it("drops the cached query list when a query is refused, so the next run reads it afresh", async () => {
    const cache = createManifestCache();
    const refusing = client(
      routes(() =>
        Response.json({
          data: null,
          errors: [{ extensions: { classification: "ValidationError" } }],
        }),
      ),
      cache,
    );
    await expect(refusing.client.query("Search", {})).rejects.toMatchObject({ stopsRun: true });
    expect(cache.get()).toBeNull();
  });

  it("retries a gateway error page and does not read it as a block", async () => {
    let answers = 0;
    const { client: c } = client(
      routes(() => {
        answers++;
        return answers === 1
          ? new Response("<html>502 Bad Gateway</html>", { status: 502 })
          : Response.json({ data: { ok: 1 } });
      }),
    );
    await expect(c.query("Search", {})).resolves.toEqual({ ok: 1 });
    expect(c.blocked).toBe(false);
  });

  it("skips a script that will not load and finds the list in a later one", async () => {
    const page = `<script src="${ASSETS}static/chunks/missing.js"></script><script src="${ASSETS}static/chunks/app.js"></script>`;
    const { client: c } = client({
      [`${BASE}/en-US/events`]: () => new Response(page),
      [`${ASSETS}static/chunks/missing.js`]: () => new Response("denied", { status: 403 }),
      [`${ASSETS}static/chunks/app.js`]: () => new Response(manifestChunk({ Search: "id-1" })),
      [`${BASE}/api/gql`]: () => Response.json({ data: { ok: true } }),
    });
    await expect(c.query("Search", {})).resolves.toEqual({ ok: true });
    expect(c.blocked).toBe(false);
  });

  it("does not walk the scripts again in the same run after a failed read", async () => {
    const { client: c, calls } = client({
      [`${BASE}/en-US/events`]: () => new Response(PAGE),
      [`${ASSETS}static/chunks/app.js`]: () => new Response("nothing here"),
    });
    await expect(c.query("Search", {})).rejects.toMatchObject({ stopsRun: true });
    const before = calls.length;
    await expect(c.query("Search", {})).rejects.toMatchObject({ stopsRun: true });
    expect(calls).toHaveLength(before);
  });

  it("reads a 429 on a script as a block and stops walking the scripts", async () => {
    const page = Array.from(
      { length: 5 },
      (_, index) => `<script src="${ASSETS}static/chunks/c${index}.js"></script>`,
    ).join("");
    const { client: c, calls } = client({
      [`${BASE}/en-US/events`]: () => new Response(page),
      [`${ASSETS}static/chunks/`]: () => new Response("slow down", { status: 429 }),
    });
    await expect(c.query("Search", {})).rejects.toBeInstanceOf(PlayriftboundBlockedError);
    expect(calls).toHaveLength(3);
    expect(c.blocked).toBe(true);
  });

  it("reads an events page that keeps failing as the source being unavailable", async () => {
    const { client: c } = client({
      [`${BASE}/en-US/events`]: () => new Response("down", { status: 503 }),
    });
    await expect(c.query("Search", {})).rejects.toBeInstanceOf(PlayriftboundUnavailableError);
    expect(c.blocked).toBe(false);
  });

  it("stops the run when the events page answers a plain 4xx", async () => {
    const { client: c } = client({
      [`${BASE}/en-US/events`]: () => new Response("missing", { status: 404 }),
    });
    const failure = await c.query("Search", {}).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PlayriftboundUnavailableError);
    expect(isRunStopping(failure)).toBe(true);
  });

  it("reads scripts that keep failing to load as the source being unavailable", async () => {
    const { client: c } = client({
      [`${BASE}/en-US/events`]: () => new Response(PAGE),
      [`${ASSETS}static/chunks/app.js`]: () => new Response("down", { status: 503 }),
    });
    await expect(c.query("Search", {})).rejects.toBeInstanceOf(PlayriftboundUnavailableError);
  });

  it("refuses when the only scripts that fail are ones the host says are missing", async () => {
    const { client: c } = client({
      [`${BASE}/en-US/events`]: () => new Response(PAGE),
      [`${ASSETS}static/chunks/app.js`]: () => new Response("gone", { status: 404 }),
    });
    await expect(c.query("Search", {})).rejects.toMatchObject({ stopsRun: true });
  });

  it("raises GraphQL errors that come with no data", async () => {
    const { client: c } = client(
      routes(() =>
        Response.json({
          data: null,
          errors: [{ message: "bad variables", extensions: { code: "BAD_REQUEST" } }],
        }),
      ),
    );
    await expect(c.query("Search", {})).rejects.toThrow(/bad variables/u);
  });

  it("retries a server error and gives up on a plain 4xx", async () => {
    let answers = 0;
    const retried = client(
      routes(() => {
        answers++;
        return answers === 1
          ? new Response("busy", { status: 503 })
          : Response.json({ data: { ok: 1 } });
      }),
    );
    await expect(retried.client.query("Search", {})).resolves.toEqual({ ok: 1 });

    const refused = client(routes(() => new Response("nope", { status: 404 })));
    await expect(refused.client.query("Search", {})).rejects.toBeInstanceOf(
      PlayriftboundRefusedError,
    );
    expect(refused.client.blocked).toBe(false);
  });

  it("reads a repeated 429 as a block, then fails every later call without a request", async () => {
    const { client: c, calls } = client(routes(() => new Response("slow down", { status: 429 })));
    await expect(c.query("Search", {})).rejects.toBeInstanceOf(PlayriftboundBlockedError);
    expect(c.blocked).toBe(true);
    const before = calls.length;
    await expect(c.query("Search", {})).rejects.toBeInstanceOf(PlayriftboundBlockedError);
    expect(calls).toHaveLength(before);
  });

  it("re-reads the query list at most once per run", async () => {
    const { client: c, calls } = client(routes(() => Response.json({ data: {} })));
    await expect(c.query("Missing", {})).rejects.toBeInstanceOf(PlayriftboundRefusedError);
    const pageReads = () =>
      calls.filter((call) => call.url.startsWith(`${BASE}/en-US/events`)).length;
    expect(pageReads()).toBe(2);
    await expect(c.query("Missing", {})).rejects.toBeInstanceOf(PlayriftboundRefusedError);
    expect(pageReads()).toBe(2);
  });

  it("fails clearly when no script holds a manifest", async () => {
    const { client: c } = client({
      [`${BASE}/en-US/events`]: () => new Response(PAGE),
      [`${ASSETS}static/chunks/app.js`]: () => new Response("nothing here"),
    });
    await expect(c.query("Search", {})).rejects.toThrow(/No persisted-query manifest/u);
  });
});
