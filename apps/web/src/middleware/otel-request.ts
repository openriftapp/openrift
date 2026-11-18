import { headersToRecord, recordSpanError } from "@openrift/shared/otel";
import type { Span } from "@opentelemetry/api";
import {
  context,
  createContextKey,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  trace,
} from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_URL_PATH,
} from "@opentelemetry/semantic-conventions";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";

import { serverFnNameFromPath } from "@/lib/server-fn-id";
import { contextWithClientIp } from "@/lib/server-fns/client-ip-context";
import { routeTree } from "@/routeTree.gen";

const tracer = trace.getTracer("openrift-web/http");

const SERVER_FN_PREFIX = "/_serverFn/";

const UNNAMED_SERVER_FN_SPAN = createContextKey("openrift.unnamed-server-fn-span");

function nameServerFnSpan(span: Span, name: string): void {
  span.updateName(`serverFn:${name}`);
  span.setAttributes({ [ATTR_HTTP_ROUTE]: `${SERVER_FN_PREFIX}${name}`, "serverfn.name": name });
}

let matcher: ReturnType<typeof createMatcher> | undefined;

const createMatcher = () =>
  createRouter({ routeTree, context: { queryClient: new QueryClient() } });

/**
 * Tempo turns http.route and the span name into metric labels, so both carry
 * the route template; the concrete path stays on url.path.
 */
const routeTemplate = (pathname: string): string => {
  matcher ??= createMatcher();
  const [, rawParams, route] = matcher.getMatchedRoutes(pathname);
  if (!route || rawParams["**"] !== undefined) {
    return "<unmatched>";
  }
  return route.fullPath;
};

// Opens an `http.server` span per request and activates it in the OTel
// context so outbound API calls made from `next()` inherit it as their parent.
export const otelRequestMiddleware = createMiddleware().server(({ next, request }) => {
  const url = new URL(request.url);
  const parentCtx = propagation.extract(ROOT_CONTEXT, headersToRecord(request.headers));

  const serverFn = serverFnNameFromPath(url.pathname);
  const route = serverFn ? `${SERVER_FN_PREFIX}${serverFn}` : routeTemplate(url.pathname);
  const spanName = serverFn ? `serverFn:${serverFn}` : `${request.method} ${route}`;

  const attributes: Record<string, string> = {
    [ATTR_HTTP_REQUEST_METHOD]: request.method,
    [ATTR_URL_PATH]: url.pathname,
    [ATTR_HTTP_ROUTE]: route,
  };
  if (serverFn) {
    attributes["serverfn.name"] = serverFn;
  }

  // Restored by the host nginx (CF-Connecting-IP via the realip module) and
  // forwarded as X-Real-IP; absent for internal requests (health checks, warmers).
  const clientIp = request.headers.get("x-real-ip") ?? "";
  if (clientIp !== "") {
    attributes["client.address"] = clientIp;
  }

  const span = tracer.startSpan(
    spanName,
    {
      kind: SpanKind.SERVER,
      attributes,
    },
    parentCtx,
  );

  let activeCtx = trace.setSpan(parentCtx, span);
  if (url.pathname.startsWith(SERVER_FN_PREFIX)) {
    activeCtx = activeCtx.setValue(UNNAMED_SERVER_FN_SPAN, { span, named: false });
  }
  if (clientIp !== "") {
    activeCtx = contextWithClientIp(activeCtx, clientIp);
  }

  return context.with(activeCtx, async () => {
    try {
      const result = await next();
      span.end();
      return result;
    } catch (error) {
      recordSpanError(span, error);
      span.end();
      throw error;
    }
  });
});

/**
 * Names a server function request's span from Start's function metadata, which dev ids do not
 * carry in their path. SSR calls and nested calls leave the span alone.
 */
export const otelServerFnMiddleware = createMiddleware({ type: "function" }).server(
  ({ next, serverFnMeta }) => {
    const pending = context.active().getValue(UNNAMED_SERVER_FN_SPAN) as
      | { span: Span; named: boolean }
      | undefined;
    if (pending && !pending.named) {
      pending.named = true;
      nameServerFnSpan(pending.span, serverFnMeta.name);
    }
    return next();
  },
);
