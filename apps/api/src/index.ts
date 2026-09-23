// Must be the first import: our OTel SDK must own the global TracerProvider
// before any module obtains a tracer, including Sentry below.
// oxlint-disable-next-line import/no-unassigned-import -- side-effect import is the canonical OTel SDK bootstrap pattern
import "./tracing.js";
import { createLogger } from "@openrift/shared/logger";
import { shutdownTracing } from "@openrift/shared/otel-node";
import { SENTRY_DATA_COLLECTION } from "@openrift/shared/sentry-data-collection";
import * as Sentry from "@sentry/bun";

import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { createConfig, validateConfig } from "./config.js";
import { createDb } from "./db/connect.js";
import { migrate } from "./db/migrate.js";
import { createRepos } from "./deps.js";
import { createEmailSender } from "./email.js";
import { createJobDefinitions } from "./jobs.js";
import { gracefulShutdown } from "./lib/graceful-shutdown.js";
import { isDroppableTransientRejection } from "./lib/transient-network-error.js";
import { wellKnownRepo } from "./modules/catalog/repositories/well-known.js";
import { validateWellKnownSlugs } from "./modules/catalog/services/validate-well-known.js";
import { createJobScheduler } from "./modules/system/services/job-scheduler.js";
import { configureRenderPool, shutdownRenderPool } from "./modules/system/services/render-pool.js";

const env = process.env as Record<string, string | undefined>;
// In containers, the deploy SHA is written to /app/.build-id by the Dockerfile.
// Absent outside containers, which disables X-Build-Id stamping.
if (!env.BUILD_ID) {
  try {
    const buildIdText = await Bun.file("/app/.build-id").text();
    env.BUILD_ID = buildIdText.trim();
  } catch {
    // not in a container, leave unset
  }
}
validateConfig(env);
const config = createConfig(env);

// Declared before Sentry.init so beforeSend can log what it drops.
const log = createLogger("api");

if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.appEnv,
    dataCollection: SENTRY_DATA_COLLECTION,
    // Our own OTel SDK (./tracing.ts) owns tracing; Sentry events take the
    // trace id of the active OTel span so an issue pivots to its Tempo trace.
    integrations: (defaults) => [
      ...defaults.filter((i) => i.name !== "BunServer"),
      Sentry.openTelemetryIntegration(),
    ],
    // postgres.js rejects a background reconnect promise nobody awaits, so a
    // transient DB blip surfaces here with no stacktrace; drop only that.
    beforeSend: (event, hint) => {
      if (!isDroppableTransientRejection(event, hint)) {
        return event;
      }
      log.warn(
        { err: hint.originalException },
        "Dropped transient network unhandled rejection from Sentry",
      );
      return null;
    },
  });
}

const { db, dialect } = createDb(config.databaseUrl);
const sendEmail = createEmailSender(config.smtp, config.isDev);

log.info("Starting API server");

log.info("Running migrations");
await migrate(db, log.child({ service: "migrate" }));

// better-auth validates its schema on creation and caches a mismatch for the
// process lifetime, so the instance must not exist before migrations ran.
const auth = createAuth({ config, db, dialect, sendEmail });

log.info("Validating well-known slugs");
await validateWellKnownSlugs(wellKnownRepo(db));

const repos = createRepos(db);

// A row left 'running' from a previous crash would block re-entrancy.
const swept = await repos.jobRuns.sweepOrphaned();
if (swept > 0) {
  log.warn({ swept }, "Marked orphaned job_runs as failed on startup");
}

const scheduler = createJobScheduler({
  repos,
  definitions: createJobDefinitions({ config, repos, db, sendEmail, log }),
  log,
});
await scheduler.start();

configureRenderPool(config.render);

const app = createApp({ db, auth, config, log, sendEmail, scheduler });

// Bun's default idleTimeout (10s) cuts slow admin requests mid-request.
// Anything long-running still belongs in runJobAsync.
const server = Bun.serve({ fetch: app.fetch, port: config.port, idleTimeout: 120 });
log.info(`API server listening on http://localhost:${config.port}`);

// Both fit inside Docker's default 10s stop timeout. Jobs cut short are marked
// failed by sweepOrphaned on the next start.
const SHUTDOWN_DRAIN_MS = 5000;
const SHUTDOWN_DEADLINE_MS = 8000;

const shutdown = gracefulShutdown({
  steps: [
    { name: "scheduler", run: () => scheduler.stop() },
    {
      name: "server",
      run: async () => {
        const drained = await Promise.race([
          server.stop().then(() => true),
          Bun.sleep(SHUTDOWN_DRAIN_MS).then(() => false),
        ]);
        if (!drained) {
          log.warn({ drainMs: SHUTDOWN_DRAIN_MS }, "Closing requests still in flight");
          await server.stop(true);
        }
      },
    },
    { name: "render pool", run: () => shutdownRenderPool() },
    { name: "database", run: () => db.destroy() },
    { name: "sentry", run: () => Sentry.flush(2000) },
    { name: "tracing", run: () => shutdownTracing() },
  ],
  deadlineMs: SHUTDOWN_DEADLINE_MS,
  log,
  exit: (code) => process.exit(code),
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(signal));
}

export { app };
