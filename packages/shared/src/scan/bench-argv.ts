export interface BenchArgvSpec {
  values: readonly string[];
  flags: readonly string[];
}

type BenchArgvCheck = { kind: "run" } | { kind: "help" } | { kind: "invalid"; message: string };

export function checkBenchArgv(argv: readonly string[], spec: BenchArgvSpec): BenchArgvCheck {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { kind: "help" };
  }
  const values = new Set(spec.values);
  const flags = new Set(spec.flags);
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] ?? "";
    if (values.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { kind: "invalid", message: `${arg} needs a value` };
      }
      index++;
    } else if (!flags.has(arg)) {
      return { kind: "invalid", message: `unknown argument ${arg}` };
    }
  }
  return { kind: "run" };
}

const SCAN_SCRIPT = /scripts[\\/]scan[\\/](?<name>[\w-]+)\.ts$/u;

export function scanScriptArgs(processArgv: readonly string[]): {
  script: string;
  args: string[];
} {
  const entry = processArgv.findIndex((arg) => SCAN_SCRIPT.test(arg));
  const script = SCAN_SCRIPT.exec(processArgv[entry] ?? "")?.[1] ?? "";
  return { script, args: processArgv.slice(entry + 1) };
}

export function checkScanArgv(
  args: readonly string[],
  spec: BenchArgvSpec,
  positionalCount: number,
): { check: BenchArgvCheck; positionals: string[] } {
  const values = new Set(spec.values);
  const options: string[] = [];
  const positionals: string[] = [];
  for (const [index, arg] of args.entries()) {
    if (values.has(args[index - 1] ?? "") || arg.startsWith("-")) {
      options.push(arg);
    } else {
      positionals.push(arg);
    }
  }
  const check = checkBenchArgv(options, spec);
  const extra = positionals[positionalCount];
  if (check.kind === "run" && extra !== undefined) {
    return { check: { kind: "invalid", message: `unexpected argument ${extra}` }, positionals };
  }
  return { check, positionals };
}
