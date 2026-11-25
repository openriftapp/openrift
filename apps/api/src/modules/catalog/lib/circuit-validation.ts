import type { Repos } from "../../../deps.js";
import { badRequest } from "../../../errors.js";

/** Rejects a circuit not in `circuits`, before the FK turns it into a raw constraint violation. */
export async function assertKnownCircuit(
  cardBans: Repos["cardBans"],
  circuit: string | null | undefined,
): Promise<void> {
  if (!circuit) {
    return;
  }
  const circuits = await cardBans.listCircuits();
  if (!circuits.some((row) => row.slug === circuit)) {
    throw badRequest(`Unknown circuit: ${circuit}`);
  }
}
