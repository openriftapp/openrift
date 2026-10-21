import type { GroupShopSource } from "@openrift/shared/group-shops";
import { groupShopKey } from "@openrift/shared/group-shops";
import {
  playriftboundEventUrl,
  playriftboundFormatLabel,
} from "@openrift/shared/playriftbound-links";
import type {
  FriendGroupShopEventResponse,
  FriendGroupShopResponse,
  FriendGroupShopSearchResult,
} from "@openrift/shared/types/api/friend-group";
import { uvsgamesEventUrl } from "@openrift/shared/uvsgames-links";

import { isoOrNull } from "../../../lib/iso-date.js";
import type {
  GroupShopRow,
  ShopEventRow,
  ShopSearchRow,
} from "../repositories/friend-group-shops.js";

export function shopEventUrl(source: GroupShopSource, externalId: string): string {
  return source === "playriftbound"
    ? playriftboundEventUrl(externalId)
    : uvsgamesEventUrl(externalId);
}

/** uvsgames publishes a format name; playriftbound an enum value, read here as its label. */
export function shopEventFormat(
  source: GroupShopSource,
  eventFormat: string | null,
): string | null {
  return source === "playriftbound" ? playriftboundFormatLabel(eventFormat) : eventFormat;
}

export function presentGroupShop(row: GroupShopRow): FriendGroupShopResponse {
  return {
    shopKey: groupShopKey(row.source, row.storeId),
    source: row.source,
    name: row.name,
    location: row.location,
    upcomingCount: row.upcomingCount,
    nextEventAt: isoOrNull(row.nextEventAt),
  };
}

export function presentShopSearchResult(
  row: ShopSearchRow,
  linkedShopKeys: ReadonlySet<string>,
): FriendGroupShopSearchResult {
  const shopKey = groupShopKey(row.source, row.storeId);
  return {
    shopKey,
    source: row.source,
    name: row.name,
    location: row.location,
    upcomingCount: row.upcomingCount,
    linked: linkedShopKeys.has(shopKey),
  };
}

export function presentShopEvent(row: ShopEventRow): FriendGroupShopEventResponse {
  return {
    externalId: row.externalId,
    name: row.name,
    startAt: row.startAt.toISOString(),
    shopKey: groupShopKey(row.source, row.storeId),
    storeName: row.storeName,
    eventFormat: shopEventFormat(row.source, row.eventFormat),
    url: shopEventUrl(row.source, row.externalId),
  };
}
