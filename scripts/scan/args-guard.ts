import { checkBenchArgv } from "../../packages/shared/src/scan/bench-argv.js";
import { SCAN_CLIS } from "./cli-specs";

const SCRIPT = /scripts[\\/]scan[\\/](?<name>[\w-]+)\.ts$/u;

function fail(message: string, usage = ""): never {
  process.stderr.write(`${message}\n${usage}`);
  return process.exit(2);
}

const entry = process.argv.findIndex((arg) => SCRIPT.test(arg));
const script = SCRIPT.exec(process.argv[entry] ?? "")?.[1] ?? "";
const cli = SCAN_CLIS[script];
if (!cli) {
  fail(`scripts/scan/cli-specs.ts has no entry for ${script || String(process.argv[1])}`);
}

const values = new Set(cli.spec.values);
const argv = process.argv.slice(entry + 1);
const options: string[] = [];

/** The arguments that are neither flags nor flag values, in order. */
export const positionals: string[] = [];

for (const [index, arg] of argv.entries()) {
  if (values.has(argv[index - 1] ?? "") || arg.startsWith("-")) {
    options.push(arg);
  } else {
    positionals.push(arg);
  }
}

const check = checkBenchArgv(options, cli.spec);
if (check.kind === "help") {
  process.stdout.write(cli.usage);
  process.exit(0);
}
if (check.kind === "invalid") {
  fail(check.message, cli.usage);
}
const extra = positionals[cli.positionals];
if (extra !== undefined) {
  fail(`unexpected argument ${extra}`, cli.usage);
}
