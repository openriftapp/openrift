import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { formatFileStamp } from "@openrift/shared/format-date";
import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import Sonda from "sonda/vite";
import type { Plugin, ViteDevServer } from "vite";
import { defineConfig, loadEnv } from "vite";

import { serverFnId } from "./src/lib/server-fn-id.ts";
import { adminRouteSplitBehavior } from "./vite-plugins/admin-route-split.ts";
import { bootChunkGuardPlugin } from "./vite-plugins/boot-chunk-guard.ts";
import { latestMilestonePlugin } from "./vite-plugins/latest-milestone.ts";
import { createCompilerBailouts } from "./vite-plugins/react-compiler-bailouts.ts";

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
const mediaDir = path.resolve(import.meta.dirname, "../../media");
const repoRoot = path.resolve(import.meta.dirname, "../..");

const MEDIA_MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
};

function serveMediaPlugin(fallbackOrigin?: string): Plugin {
  return {
    name: "serve-media",
    configureServer(server) {
      server.middlewares.use("/media", (req, res, _next) => {
        // Same mapping as nginx: a public card image URL has no shard directory.
        const urlPath = (req.url?.split("?")[0] ?? "").replace(
          /^\/cards\/(?<id>[0-9a-f-]*(?<shard>[0-9a-f]{2}))-(?<variant>[0-9a-z]+)\.webp$/u,
          "/cards/$<shard>/$<id>-$<variant>.webp",
        );
        const filePath = path.join(mediaDir, urlPath);
        if (!existsSync(filePath)) {
          if (fallbackOrigin) {
            res.statusCode = 302;
            res.setHeader("Location", `${fallbackOrigin}/media${urlPath}`);
            res.end();
            return;
          }
          // Must 404 here, not fall through to next(): that routes the request
          // through the full SSR pipeline for every missing thumbnail.
          res.statusCode = 404;
          res.end();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MEDIA_MIME_TYPES[ext] ?? "application/octet-stream");
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

const DEVICE_RUNS_DIR = path.join(repoRoot, "data/image-recognition-test/device-runs");
/** Bytes. */
const DEVICE_RUN_MAX_SIZE = 5_000_000;

const saveDeviceRunPlugin: Plugin = {
  name: "save-device-run",
  configureServer(server) {
    server.middlewares.use("/__device-runs", (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end();
        return;
      }
      const kind =
        new URL(req.url ?? "", "http://dev").searchParams.get("kind") === "speed"
          ? "speed"
          : "bench";
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= DEVICE_RUN_MAX_SIZE) {
          chunks.push(chunk);
        }
      });
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        let valid = size <= DEVICE_RUN_MAX_SIZE;
        try {
          JSON.parse(text);
        } catch {
          valid = false;
        }
        if (!valid) {
          res.statusCode = 400;
          res.end();
          return;
        }
        const name = `${formatFileStamp(new Date())}-${kind}.json`;
        mkdirSync(DEVICE_RUNS_DIR, { recursive: true });
        writeFileSync(path.join(DEVICE_RUNS_DIR, name), text);
        res.statusCode = 201;
        res.end(name);
      });
    });
  },
};

const compilerBailouts = createCompilerBailouts(import.meta.dirname, true);

// Off only in the pre-merge check, where scripts/check-react-compiler.ts compiles the changed files instead.
const reactCompilerOff = process.env.OPENRIFT_REACT_COMPILER === "off";

// Nothing else in the toolchain fails the build on a compiler bailout; this
// is the only guard. Build only: dev keeps running and just logs.
const reactCompilerBailoutGuard: Plugin = {
  name: "react-compiler-bailout-guard",
  apply: "build",
  buildEnd() {
    const report = compilerBailouts.takeReport();
    if (report !== undefined) {
      throw new Error(report);
    }
  },
};

// Disables source-map upload (keeps middleware auto-instrumentation) when
// SENTRY_AUTH_TOKEN is absent, so this is safe in local/dev builds.
const sentryPlugins = sentryTanstackStart({
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: commitHash },
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});

const BASE_UI_SUBPATHS = [
  "accordion",
  "alert-dialog",
  "avatar",
  "button",
  "checkbox",
  "collapsible",
  "context-menu",
  "dialog",
  "drawer",
  "input",
  "menu",
  "merge-props",
  "navigation-menu",
  "popover",
  "preview-card",
  "progress",
  "radio",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "slider",
  "switch",
  "tabs",
  "toggle",
  "toggle-group",
  "tooltip",
  "use-render",
];

const paraglideOptions = {
  project: "./project.inlang",
  outdir: "./src/paraglide",
  outputStructure: "virtual-modules",
} as const;

export default defineConfig(({ mode, command }) => {
  // Loaded into process.env (not baked into the bundle) so SSR code can read
  // server-only vars like API_INTERNAL_URL at runtime.
  const env = loadEnv(mode, repoRoot, "");
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3000";

  return {
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash),
    },
    resolve: {
      // tsconfig points @/paraglide at the CLI compile that typecheck and lint read; the app
      // ships this plugin's output. Aliases resolve before tsconfig paths.
      alias: { "@/paraglide": path.resolve(import.meta.dirname, paraglideOptions.outdir) },
      tsconfigPaths: true,
    },
    optimizeDeps: {
      // Deps reached only through dynamic imports are otherwise discovered
      // mid-session, and each discovery re-optimizes and breaks in-flight imports.
      include: [
        "better-auth/react",
        "better-auth/client/plugins",
        "sonner",
        "@sentry/tanstackstart-react",
        "@openrift/shared > qrcode",
        ...BASE_UI_SUBPATHS.map((subpath) => `@base-ui/react/${subpath}`),
      ],
    },
    environments: {
      ssr: {
        resolve: {
          // Build must bundle @opentelemetry/* (Nitro's tracer misses CJS
          // requires, causing 500s); dev's ESM runner throws on it instead.
          noExternal: command === "build" ? [/^@opentelemetry\//u] : [],
        },
      },
    },
    plugins: [
      latestMilestonePlugin(),
      // Must be first plugin. Off by default in dev: it costs ~0.8s of every
      // cold SSR request. `bun run dev:devtools` opts in. Always on for build,
      // which is where it strips <TanStackDevtools> out of the bundle.
      ...(command === "build" || process.env.VITE_DEVTOOLS ? [devtools()] : []),
      // getUserMedia (the card scanner's camera) needs a secure context.
      // `bun run dev:http` opts out for e2e, curl checks and self-signed-averse flows.
      ...(process.env.DEV_HTTPS
        ? [
            basicSsl(),
            // Unlocks SharedArrayBuffer for onnxruntime's threaded WASM. COEP
            // blocks any subresource without CORP/CORS; use dev:http if that bites.
            {
              name: "dev-cross-origin-isolation",
              configureServer(server: ViteDevServer) {
                server.middlewares.use((_req, res, next) => {
                  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                  next();
                });
              },
            },
            // Firefox drops random module streams from Node's HTTP/2 dev server
            // (vitejs/vite#21569); stay on HTTP/1.1 over TLS until that is fixed.
            {
              name: "dev-https-http1",
              config: () => ({
                server: {
                  https: {
                    ALPNCallback: ({ protocols }: { protocols: string[] }) =>
                      protocols.includes("http/1.1") ? "http/1.1" : undefined,
                  },
                },
              }),
            },
          ]
        : []),
      serveMediaPlugin(env.CATALOG_SOURCE_URL?.replace(/\/$/u, "")),
      saveDeviceRunPlugin,
      // Compiles messages/*.json into src/paraglide. Remaining options live in
      // project.inlang/paraglide.config.ts so the CLI reads the same setup.
      paraglideVitePlugin(paraglideOptions),
      tailwindcss(),
      // Router options live in tsr.config.json so this plugin and the lint
      // job's `tsr generate` read the same routeFileIgnorePattern.
      tanstackStart({
        router: { codeSplittingOptions: { splitBehavior: adminRouteSplitBehavior } },
        serverFns: {
          generateFunctionId: ({ filename, functionName }) =>
            serverFnId(
              functionName,
              createHash("sha256").update(`${filename}--${functionName}`).digest("hex"),
            ),
        },
      }),
      // Build only: in dev, Nitro caches stale SSR HTML after HMR, causing
      // hydration mismatches. https://github.com/TanStack/router/issues/6556
      command === "build" &&
        nitro({
          preset: "bun",
          plugins: ["./nitro/exit-on-close.ts"],
          // Opt-in via `bun run start:lh`; prod is already compressed by Cloudflare/nginx.
          compressPublicAssets: process.env.COMPRESS ? { gzip: true, brotli: true } : false,
        }),
      viteReact(),
      ...(reactCompilerOff
        ? []
        : [
            babel({
              // Generated message code has no components, and _index.js alone is 3 MB.
              exclude: [/[/\\]node_modules[/\\]/u, /[/\\]src[/\\]paraglide[/\\]/u],
              presets: [reactCompilerPreset({ logger: compilerBailouts.logger })],
            }),
            reactCompilerBailoutGuard,
          ]),
      bootChunkGuardPlugin(),
      ...sentryPlugins,
      // Opt-in via `bun run analyze`, to avoid the post-build cost on every prod build.
      ...(process.env.ANALYZE
        ? [
            Sonda({
              open: false,
              gzip: true,
              brotli: true,
              deep: true,
              sources: true,
            }),
          ]
        : []),
    ],
    // The scan worker imports messages, and Vite bundles workers with only these plugins.
    worker: { plugins: () => [paraglideVitePlugin(paraglideOptions)] },
    build: {
      target: "es2024",
      sourcemap: true,
      // Fonts return false: the production CSP blocks data: URIs for font-src.
      // Everything else must return undefined, not true, or every asset inlines.
      assetsInlineLimit: (filePath: string) =>
        /\.(?:woff2?|ttf|otf|eot)$/u.test(filePath) ? false : undefined,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                test: /node_modules\/react-dom/u,
                name: "react-dom",
              },
              // Must come before tanstack-db: query-core is shared by both,
              // and if db's group wins first it pulls tanstack-db into routes that don't use it.
              {
                test: /node_modules\/@tanstack\/(?:react-query|query-core)/u,
                name: "tanstack-query",
              },
              {
                test: /node_modules\/@tanstack\/(?:react-router|router-core)/u,
                name: "tanstack-router",
              },
              {
                test: /node_modules\/@tanstack\/(?:db|react-db|query-db-collection)/u,
                name: "tanstack-db",
              },
              {
                test: /node_modules\/(?:better-auth|@better-auth)/u,
                name: "better-auth",
              },
              {
                test: /node_modules\/(?:@base-ui\/react\/(?:navigation-menu|menu|popover|tooltip|avatar|separator|button|dialog|drawer|merge-props|use-render|utils|internals|floating-ui-react)|@base-ui\/utils|@floating-ui)\//u,
                name: "base-ui-shell",
              },
              {
                test: /node_modules\/(?:@base-ui|@floating-ui)/u,
                name: "base-ui",
              },
              {
                test: /node_modules\/sonner/u,
                name: "sonner",
              },
              // Unbundled, each icon became its own ~500B chunk. Grouping app
              // source further was measured to cost more than it saves; re-measure before adding groups here.
              {
                test: /node_modules\/lucide-react/u,
                name: "lucide",
              },
            ],
          },
        },
      },
    },
    server: {
      host: true,
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
      strictPort: Boolean(process.env.PORT),
      // Dev only; nginx handles /api/* in production.
      proxy: {
        "/api/auth": { target: apiProxyTarget },
        "/api/admin": { target: apiProxyTarget },
        "/api/v1": { target: apiProxyTarget },
        "/api/health": { target: apiProxyTarget },
        "/api/doc": { target: apiProxyTarget },
        "/api/ui": { target: apiProxyTarget },
        "/api/developers": { target: apiProxyTarget },
        "/api/swagger-ui-dist": { target: apiProxyTarget },
      },
    },
  };
});
