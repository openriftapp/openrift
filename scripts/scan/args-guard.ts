import { checkScanArgv, scanScriptArgs } from "../../packages/shared/src/scan/bench-argv.js";
import { SCAN_CLIS } from "./cli-specs";

function fail(message: string, usage = ""): never {
  process.stderr.write(`${message}\n${usage}`);
  return process.exit(2);
}

const { script, args } = scanScriptArgs(process.argv);
const cli = SCAN_CLIS[script];
if (!cli) {
  fail(`scripts/scan/cli-specs.ts has no entry for ${script || String(process.argv[1])}`);
}

const parsed = checkScanArgv(args, cli.spec, cli.positionals);

/** The arguments that are neither flags nor flag values, in order. */
export const positionals: string[] = parsed.positionals;

if (parsed.check.kind === "help") {
  process.stdout.write(cli.usage);
  process.exit(0);
}
if (parsed.check.kind === "invalid") {
  fail(parsed.check.message, cli.usage);
}
