import { POSTGRES_INTEGER_MAX } from "./schemas.js";

export const GROUP_SHOP_SOURCES = ["uvsgames", "playriftbound"] as const;

export type GroupShopSource = (typeof GROUP_SHOP_SOURCES)[number];

/** `<source>:<store id>`, so one list can hold stores from both sources. */
export function groupShopKey(source: GroupShopSource, storeId: string | number): string {
  return `${source}:${storeId}`;
}

export const GROUP_SHOP_SOURCE_LABELS: Record<GroupShopSource, string> = {
  uvsgames: "UVS Games",
  playriftbound: "PlayRiftbound",
};

export function parseGroupShopKey(
  key: string,
): { source: GroupShopSource; storeId: string } | null {
  const separator = key.indexOf(":");
  const source = GROUP_SHOP_SOURCES.find((candidate) => candidate === key.slice(0, separator));
  const storeId = key.slice(separator + 1);
  if (separator === -1 || source === undefined || storeId === "") {
    return null;
  }
  if (
    source === "uvsgames" &&
    !(/^[1-9]\d*$/u.test(storeId) && Number(storeId) <= POSTGRES_INTEGER_MAX)
  ) {
    return null;
  }
  return { source, storeId };
}
