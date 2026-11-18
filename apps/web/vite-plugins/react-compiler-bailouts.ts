import path from "node:path";

interface CompilerLoggerEvent {
  kind: string;
  reason?: string;
  detail?: {
    loc?: { start?: { line: number; column: number } } | null;
    options?: { reason?: string; category?: string };
  };
}

const ALLOWED_COMPILER_BAILOUTS: Record<string, string> = {
  "src/lib/virtualizer-fresh.ts":
    'CompileSkip: carries "use no memo" on purpose (TanStack/virtual#736)',
};

const BAILOUT_KINDS = new Set([
  "CompileError",
  "CompileSkip",
  "CompileDiagnostic",
  "PipelineError",
]);

export interface CompilerBailouts {
  logger: { logEvent: (filename: string | null, rawEvent: unknown) => void };
  /** Returns the collected bailouts as a failure message and clears them, or undefined when there are none. */
  takeReport: () => string | undefined;
}

export function createCompilerBailouts(webRoot: string, verbose: boolean): CompilerBailouts {
  const bailouts = new Map<string, string>();
  return {
    logger: {
      logEvent(filename, rawEvent) {
        const event = rawEvent as CompilerLoggerEvent;
        if (!BAILOUT_KINDS.has(event.kind)) {
          return;
        }
        const relative = filename ? path.relative(webRoot, filename) : "?";
        const loc = event.detail?.loc?.start;
        const at = loc ? `:${loc.line}:${loc.column}` : "";
        if (!(relative in ALLOWED_COMPILER_BAILOUTS)) {
          const reason = event.detail?.options?.reason ?? event.reason ?? "no reason given";
          bailouts.set(relative, `${event.kind}${at}: ${reason}`);
        }
        if (verbose) {
          console.log(`[react-compiler] ${event.kind} ${relative}${at}`);
          if (event.detail) {
            // console.log's default depth=2 would truncate nested detail as "[Object]".
            console.dir(event.detail, { depth: null, colors: true });
          }
        }
      },
    },
    takeReport() {
      if (bailouts.size === 0) {
        return;
      }
      const listed = [...bailouts].map(([file, summary]) => `  ${file}\n    ${summary}`);
      bailouts.clear();
      return (
        `React Compiler bailed on ${listed.length} file(s), which therefore ship unoptimized:\n` +
        `${listed.join("\n")}\n\n` +
        "Rewrite the flagged code. Common causes: a conditional, logical operator, " +
        "optional call or loop inside a try/catch; a `finally` clause; a function " +
        "declared after the component's return; a call to a function declared later " +
        "in the same body. If the bailout is genuinely unavoidable, add the file to " +
        "ALLOWED_COMPILER_BAILOUTS in apps/web/vite-plugins/react-compiler-bailouts.ts with a reason."
      );
    },
  };
}
