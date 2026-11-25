import type { LegalityContext } from "@openrift/shared/format-legality";
import type { InitResponse } from "@openrift/shared/types/api/init";

const contexts = new WeakMap<InitResponse, Map<string, LegalityContext>>();

/** One context per init payload and circuit, so every reader shares its identity. */
export function legalityContextFor(init: InitResponse, playCircuit: string): LegalityContext {
  let byCircuit = contexts.get(init);
  if (!byCircuit) {
    byCircuit = new Map();
    contexts.set(init, byCircuit);
  }
  const cached = byCircuit.get(playCircuit);
  if (cached) {
    return cached;
  }
  const known = init.circuits.some((circuit) => circuit.slug === playCircuit);
  const context: LegalityContext = {
    ...(known ? { circuit: playCircuit } : {}),
    windows: init.formatSets,
  };
  byCircuit.set(playCircuit, context);
  return context;
}
