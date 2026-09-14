import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createClientOnlyFn } from "@tanstack/react-start";

import { RouterErrorFallback } from "./components/error-fallback";
import { NotFoundFallback } from "./components/error-message";
import { setDiagnosticsSources } from "./lib/app-diagnostics";
import { createQueryClient } from "./lib/query-client";
import { initVersionStaleNavigationReload } from "./lib/stale-bundle-reload";
import { routeTree } from "./routeTree.gen";

// Server Sentry bootstraps in instrument.server.mjs; the client SDK loads off
// the critical path, and the compiler drops this import from the server build.
const loadClientSentry = createClientOnlyFn(() => import("./lib/sentry-client"));

export function getRouter() {
  const queryClient = createQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultErrorComponent: RouterErrorFallback,
    defaultNotFoundComponent: NotFoundFallback,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ router, queryClient, wrapQueryClient: true });

  if (!router.isServer) {
    setDiagnosticsSources({ queryClient, router });
    void (async () => {
      const { initClientSentry } = await loadClientSentry();
      initClientSentry(router);
    })();
    initVersionStaleNavigationReload(router);
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }

  interface StaticDataRouteOption {
    hideFooter?: boolean;
  }
}
