import type { Logger } from "@openrift/shared/logger";

export interface ShutdownStep {
  name: string;
  run: () => unknown;
}

interface GracefulShutdownOptions {
  steps: ShutdownStep[];
  deadlineMs: number;
  log: Logger;
  exit: (code: number) => void;
}

export function gracefulShutdown({
  steps,
  deadlineMs,
  log,
  exit,
}: GracefulShutdownOptions): (signal: string) => Promise<void> {
  let started = false;
  let exited = false;
  const finish = (code: number) => {
    if (!exited) {
      exited = true;
      exit(code);
    }
  };

  return async (signal) => {
    if (started) {
      return;
    }
    started = true;
    log.info({ signal }, "Shutting down");

    let current = "";
    const deadline = setTimeout(() => {
      log.warn({ step: current, deadlineMs }, "Shutdown deadline passed, exiting");
      finish(1);
    }, deadlineMs);

    for (const step of steps) {
      current = step.name;
      try {
        await step.run();
      } catch (error) {
        log.error({ err: error, step: step.name }, "Shutdown step failed");
      }
    }

    clearTimeout(deadline);
    log.info("Shutdown complete");
    finish(0);
  };
}
