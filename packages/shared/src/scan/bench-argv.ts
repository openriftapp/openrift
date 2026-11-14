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
