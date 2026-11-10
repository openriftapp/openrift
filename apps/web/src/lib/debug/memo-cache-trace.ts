// Keep behind import.meta.env.DEV: Vite dead-code-eliminates this only if the guard stays.
if (import.meta.env.DEV) {
  const original = console.error;
  console.error = function interceptedError(...args: unknown[]): void {
    const first = args[0];
    if (typeof first === "string" && first.includes("previous cache was allocated with size")) {
      const [allocated, requested] = args.slice(1);
      const stack = new Error("stack").stack ?? "(no stack)";
      const trimmed = stack
        .split("\n")
        .slice(1)
        .filter((line) => !line.includes("memo-cache-trace") && line.trim() !== "");
      console.log(
        `[react-compiler-mismatch] allocated=${String(allocated)} requested=${String(requested)}`,
      );
      for (const line of trimmed.slice(0, 15)) {
        console.log(`  ${line.trim()}`);
      }
    }
    return Reflect.apply(original, this, args);
  };
}
