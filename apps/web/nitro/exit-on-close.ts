import { shutdownTracing } from "@openrift/shared/otel-node";
import * as Sentry from "@sentry/tanstackstart-react";
import { definePlugin } from "nitro";

// srvx's Bun adapter closes the server on SIGTERM but never exits, and live
// timers such as the shared server cache's GC keep the process up until SIGKILL.
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    await Promise.all([Sentry.flush(2000), shutdownTracing()]);
    process.exit(0);
  });
});
