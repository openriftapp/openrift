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

export function presentGroupShop(row: GroupShopRow): FriendGroupShopResponse {
  return {
    storeId: row.storeId,
    name: row.name,
    location: row.location,
    upcomingCount: row.upcomingCount,
    nextEventAt: isoOrNull(row.nextEventAt),
  };
}

export function presentShopSearchResult(
  row: ShopSearchRow,
  linkedStoreIds: ReadonlySet<number>,
): FriendGroupShopSearchResult {
  return {
    storeId: row.storeId,
    name: row.name,
    location: row.location,
    upcomingCount: row.upcomingCount,
    linked: linkedStoreIds.has(row.storeId),
  };
}

export function presentShopEvent(row: ShopEventRow): FriendGroupShopEventResponse {
  return {
    externalId: row.externalId,
    name: row.name,
    startAt: row.startAt.toISOString(),
    storeId: row.storeId,
    storeName: row.storeName,
    eventFormat: row.eventFormat,
    url: uvsgamesEventUrl(row.externalId),
  };
}
