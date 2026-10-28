import type { Transact } from "../../../deps.js";

/**
 * Takes a published event off the archive and rejects every mirrored row it was
 * built from, so no refresh or auto-publish brings it back. Restoring a row
 * under Rejected makes it undecided again.
 */
export function removeMetaEvent(transact: Transact, eventId: string): Promise<boolean> {
  return transact(async (repos) => {
    const sources = await repos.meta.sourcesForEvent(eventId);
    const deleted = await repos.meta.deleteEvent(eventId);
    if (!deleted) {
      return false;
    }
    for (const source of sources) {
      if (source.provider !== null && source.externalId !== null) {
        await repos.metaOverlays.ignoreEvent(source.provider, source.externalId);
      }
    }
    return true;
  });
}

/**
 * Undoes a publish that has not collected anything yet: the event goes, its
 * mirrored rows turn undecided again. An event with standings is kept.
 */
export function unpublishMetaEvent(
  transact: Transact,
  eventId: string,
): Promise<"unpublished" | "kept" | "missing"> {
  return transact(async (repos) => {
    const event = await repos.meta.eventById(eventId);
    if (event === undefined) {
      return "missing";
    }
    if (event.playerRowCount > 0) {
      return "kept";
    }
    await repos.meta.deleteEvent(eventId);
    return "unpublished";
  });
}
