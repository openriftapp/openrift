import type { Collection } from "@tanstack/react-db";

type AnyCollection = Collection<any, any, any, any, any>;

/** Loads a store. A failed first load stays failed until reload(); preload() only rejects again. */
export function loadCollection(collection: AnyCollection): Promise<void> {
  return collection.status === "error" ? collection.reload() : collection.preload();
}
