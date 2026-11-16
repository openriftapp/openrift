import type { Collection } from "@tanstack/react-db";

export type AnyCollection = Pick<
  Collection,
  "id" | "status" | "subscriberCount" | "on" | "preload" | "reload" | "cleanup"
>;

/** Loads a store. A failed first load stays failed until reload(); preload() only rejects again. */
export function loadCollection(collection: AnyCollection): Promise<void> {
  return collection.status === "error" ? collection.reload() : collection.preload();
}
