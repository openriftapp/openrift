import type { PublicDeckDetailResponse } from "@openrift/shared/types/api/deck";
import type { QueryClient } from "@tanstack/react-query";

import { publicDeckQueryOptions } from "@/features/decks/lib/decks-queries";
import { metaDeckQueryOptions } from "@/features/meta/lib/meta-queries";

/**
 * One side of `/decks/compare?from=&to=`. A bare value is a deck id (server
 * or `local:`); `meta:<token>` and `share:<token>` name a public deck.
 */
export type CompareSide =
  | { kind: "deck"; deckId: string }
  | { kind: "meta"; token: string }
  | { kind: "share"; token: string };

export type DeckLinkKind = "meta" | "share";

const LINK_PARAM = /^(?<kind>meta|share):(?<token>[A-Za-z0-9]{6,64})$/u;

export function parseCompareSide(value?: string): CompareSide | null {
  if (value === undefined || value === "") {
    return null;
  }
  const match = LINK_PARAM.exec(value);
  const token = match?.groups?.token;
  if (token === undefined) {
    return { kind: "deck", deckId: value };
  }
  return match?.groups?.kind === "meta" ? { kind: "meta", token } : { kind: "share", token };
}

export function compareLinkParam(kind: DeckLinkKind, token: string): string {
  return `${kind}:${token}`;
}

/** A meta deck's payload extends the share payload, so either link reads as a public deck. */
export function queryDeckLink(
  queryClient: QueryClient,
  kind: DeckLinkKind,
  token: string,
): Promise<PublicDeckDetailResponse> {
  return kind === "meta"
    ? queryClient.query(metaDeckQueryOptions(token))
    : queryClient.query(publicDeckQueryOptions(token));
}
