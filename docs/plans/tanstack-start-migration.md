# TanStack Start Migration Plan

A step-by-step plan to migrate the web app from a Vite SPA to TanStack Start
with SSR. Each step is self-contained — the app works after every step.

**Prerequisites:** Complete the preparation checklist in
`tanstack-preparations.md` first (browser-global guards, configurable clients,
QueryClient factory, etc.).

---

## Current State

- **Web**: Vite SPA with TanStack Router (file-based) + TanStack Query +
  better-auth client
- **API**: Separate Hono server (Kysely/Postgres, cron jobs, OpenAPI,
  better-auth server)
- **Deployment**: Docker — Nginx serves static SPA + reverse proxies `/api` to
  Hono
- **Key advantage**: Already on TanStack Router with file-based routing, so
  route files need minimal changes

The Hono API stays as-is throughout. The migration converts the web app from a
Vite SPA to a TanStack Start app with SSR.

---

## Step 1: Add TanStack Start dependencies and `app.config.ts`

**Goal:** Replace Vite's build system with TanStack Start's, but keep the app as
a client-rendered SPA (no SSR yet). The app should build and run identically.

**Changes:**

- Add `@tanstack/react-start`, `@tanstack/start-vite-plugin`, and `vinxi` to
  `apps/web`
- Create `apps/web/app.config.ts` — the TanStack Start config, migrating
  settings from `vite.config.ts` (Tailwind plugin, React compiler, proxy config,
  PWA, code splitting)
- Update `apps/web/package.json` scripts: `dev` → `vinxi dev`, `build` →
  `vinxi build`, `start` → `vinxi start`
- Keep `vite.config.ts` temporarily (TanStack Start wraps Vite internally via
  `app.config.ts`, so port settings then delete it)
- Update `turbo.json` if build outputs change

**Verify:** `bun dev:web` starts, all pages load, API proxy works, HMR works.

---

## Step 2: Add server and client entry points

**Goal:** Add the entry files TanStack Start requires for SSR bootstrapping, but
still render client-only.

**Changes:**

- Create `apps/web/app/ssr.tsx` — the server entry that renders the app to HTML
  (initially just returns the shell with `<div id="root">` and client scripts,
  like a traditional SPA)
- Create `apps/web/app/client.tsx` — the client entry that hydrates (replaces
  current `src/main.tsx`)
- Update `__root.tsx` to use `<Scripts>`, `<Meta>`, `<Html>`, `<Body>` from
  `@tanstack/react-start` (these are the SSR document wrapper components)
- Move the `QueryClientProvider` and `NuqsAdapter` setup into the root route's
  `wrapInContext` or keep in `__root.tsx`
- Update `router.ts` to use `createRouter` with `routerContext` that includes
  the `queryClient` (likely already done since `context.queryClient` is used in
  loaders)

**Verify:** App builds, hydrates on client, all routes work. Browser view-source
shows the HTML shell.

---

## Step 3: Enable SSR rendering

**Goal:** The server now renders full HTML with React content (not just an empty
shell). This is the core SSR step.

**Changes:**

- Update `ssr.tsx` to call `createStartHandler` and use the router's
  `StartServer` component
- Update `client.tsx` to call `hydrateRoot` via `StartClient`
- Update `router.ts`: set `defaultPreload: 'intent'` and configure SSR-related
  options (`dehydrate`/`hydrate` for TanStack Query state transfer)
- Add `dehydrate`/`hydrate` to the router config so TanStack Query cache
  serializes to HTML and rehydrates on the client
- All existing route loaders (`ensureQueryData`) will now run on the server
  during SSR, then the cached data transfers to the client — no double-fetching

**Critical — server-side API calls:** Route loaders call the Hono API via the
RPC client. During SSR, these requests come from the server process, not the
browser. The `/api` proxy won't work server-side. Fix:

- In the RPC client, detect SSR (`typeof window === 'undefined'`) and use an
  absolute URL (e.g., `http://localhost:3000`) instead of the relative `/api`
  path
- Forward cookies from the incoming request to API calls (for auth). TanStack
  Start provides `getRequestHeaders()` in server context for this

**Verify:** View-source shows rendered HTML with card data. Pages load faster (no
client-side waterfall). Auth-protected routes still redirect correctly.

---

## Step 4: Server-side auth with `createServerFn`

**Goal:** Move auth session checking to a server function so the session is
resolved server-side (faster, more secure, no flash of unauthenticated content).

**Changes:**

- Create `apps/web/src/lib/auth-server.ts` with a `getServerSession` server
  function:
  ```ts
  const getServerSession = createServerFn({ method: "GET" }).handler(
    async () => {
      const request = getWebRequest();
      const session = await authClient.getSession({
        headers: request.headers, // forward cookies
      });
      return session;
    },
  );
  ```
- Update `sessionQueryOptions` to use the server function as its `queryFn`
  (works on both server and client because `createServerFn` auto-bridges)
- Update `_authenticated/route.tsx` and `admin/route.tsx` `beforeLoad` — they
  already use `ensureQueryData(sessionQueryOptions())`, so they'll automatically
  use the server function
- Similarly, convert `featureFlagsQueryOptions` and `siteSettingsQueryOptions` to
  use server functions (these are loaded in `__root.tsx` and benefit from
  server-side fetching)

**Verify:** Auth redirects work without a flash. Protected pages render
server-side with user data. Login/logout still work.

---

## Step 5: Convert remaining data fetching to server functions (incremental)

**Goal:** Move API calls behind server functions where it makes sense. This is
incremental — do one route at a time, each is independently deployable.

**Priority order** (high traffic / high impact first):

1. `/cards` — `catalogQueryOptions` (biggest payload, biggest SSR win)
2. `/collections` — `collectionsQueryOptions`, `copiesQueryOptions`,
   `catalogQueryOptions`
3. `/decks` — `decksQueryOptions`, `deckDetailQueryOptions`
4. Admin routes — lower priority, admin-only

**Pattern for each:**

```ts
const fetchCatalogServer = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getWebRequest();
    const response = await fetch("http://localhost:3000/api/v1/catalog", {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    return response.json();
  },
);
```

Then update the `queryOptions` to use the server function. Components using
`useSuspenseQuery` don't change at all.

**Alternative:** Instead of wrapping the Hono RPC client in server functions, you
could import Kysely repositories directly into server functions (bypassing the
API for SSR). This is faster but creates tighter coupling. Recommendation: keep
the API boundary.

**Verify after each route:** Page renders server-side with data. Client
navigation still works (server function called via RPC). No regressions.

---

## Step 6: Update deployment (Docker + Nginx)

**Goal:** The web app is now a Node/Bun server (not static files). Update the
Docker build and Nginx config.

**Changes:**

- **Dockerfile web stage:** Replace nginx with Bun runtime. The Start app runs
  its own HTTP server (Vinxi/Nitro). Build output is in `.output/` (or similar,
  depending on Vinxi preset)
- **Nginx config:** Instead of serving static files + SPA fallback, proxy all
  non-API traffic to the Start server (similar to how `/api` is proxied to Hono
  today):
  ```nginx
  location / {
    proxy_pass http://web:3001;  # TanStack Start server
  }
  location /api/ {
    proxy_pass http://api:3000;  # Hono API (unchanged)
  }
  ```
- **Docker Compose:** Update `web` service to use Bun image instead of nginx.
  Add `PORT=3001` env var. Keep the card-images volume mount (Start server will
  need to serve these, or keep nginx for static assets)
- **Static assets:** Configure Start/Nitro to serve `/assets/*` and
  `/card-images/*` with long cache headers, or keep a nginx layer in front for
  static asset serving (recommended for performance)
- **PWA:** Verify service worker registration and manifest still work with SSR

**Recommended production architecture:**

```
Client → Nginx (TLS, static assets, rate limiting)
           ├→ /api/* → Hono (port 3000)
           ├→ /assets/*, /card-images/* → filesystem (static)
           └→ /* → TanStack Start (port 3001)
```

**Verify:** Production build works in Docker. Pages SSR correctly. Static assets
have correct cache headers. PWA installs and works offline.

---

## Step 7: Cleanup

**Goal:** Remove legacy code and optimize.

**Changes:**

- Delete `vite.config.ts` (fully replaced by `app.config.ts`)
- Delete old `src/main.tsx` (replaced by `app/client.tsx`)
- Remove the Vite proxy config (server functions talk directly to the API)
- Audit bundle size — SSR should reduce the initial JS payload since data is
  embedded in HTML
- Consider streaming SSR (`renderToPipeableStream`) for large pages like the
  card catalog
- Update `CLAUDE.md` with new commands and architecture

---

## Risk Mitigation

| Risk                                           | Mitigation                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| RPC client breaks in SSR (no browser cookies)  | Step 3 addresses this with cookie forwarding. Test early.                                                                     |
| TanStack Start is relatively new               | Pin exact version. The router/query layer is mature — Start is mainly the SSR glue.                                           |
| PWA + SSR conflicts                            | Service worker caching strategy may need adjustment. Test offline mode at Step 6.                                             |
| better-auth session cookie handling in SSR     | Step 4 tackles this explicitly. The cookie needs to be forwarded from the incoming request to API calls.                      |
| Build time increase (SSR adds server bundle)   | Likely minimal with Vinxi. Monitor.                                                                                           |
| Card images serving                            | Keep nginx for static files in production. Don't serve large images through the SSR server.                                   |

---

## What Stays the Same

- **Hono API server** — untouched
- **All route files** — structure is identical (TanStack Router → TanStack Start
  is additive)
- **All components** — no changes needed
- **TanStack Query usage** — `useSuspenseQuery`, `queryOptions` patterns all
  preserved
- **packages/shared** — untouched
- **Database, auth server, cron jobs** — untouched

---

## Summary

Each step is independently deployable and the app works after each one. Steps
1–3 are the core migration. Steps 4–5 are incremental improvements. Step 6 is
deployment. You could stop after Step 3 and already have a working SSR app.
