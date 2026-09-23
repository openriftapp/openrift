/* oxlint-disable typescript/no-unsafe-member-access -- .mjs outside the TS project, so `process` resolves untyped */
// Imported at the top of src/server.ts, before any request handling. Bun runs
// `.output/server/index.mjs` directly, so Node's --import bootstrap hook
// isn't available here; this file is the manual equivalent. DSN comes from
// env, not site_settings, because init runs before the DB is reachable.

import { parseAppEnv } from "@openrift/shared/app-env";
import { SENTRY_DATA_COLLECTION } from "@openrift/shared/sentry-data-collection";
import * as Sentry from "@sentry/tanstackstart-react";

import { dropExpectedClientErrors, fingerprintApiFaults } from "./lib/sentry-server-filter";

// Skip in local dev to keep stray dev events out of the shared Sentry project.
const appEnv = parseAppEnv(process.env.APP_ENV);
const dsn = process.env.SENTRY_DSN_SSR;
if (dsn && appEnv !== "development") {
  Sentry.init({
    dsn,
    environment: appEnv,
    release: process.env.COMMIT_HASH,
    dataCollection: SENTRY_DATA_COLLECTION,
    // Our own OTel SDK (tracing.server.ts) owns tracing; Sentry events take the
    // trace id of the active OTel span so an issue pivots to its Tempo trace.
    integrations: [Sentry.openTelemetryIntegration()],
    // Message-matched: these carry no HTTP status, so they can't be dropped
    // structurally like the API's 4xx (handled in beforeSend below).
    ignoreErrors: [
      "NOT_FOUND",
      /^AbortError: The connection was closed/u,
      /^Server function (?:info not found|module not resolved)/u,
    ],
    beforeSend: (event, hint) => {
      const kept = dropExpectedClientErrors(event, hint);
      if (kept === null) {
        return null;
      }
      return fingerprintApiFaults(kept, hint);
    },
    initialScope: { tags: { service: "web-ssr" } },
  });
}
