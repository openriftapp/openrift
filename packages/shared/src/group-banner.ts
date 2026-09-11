/** Wire form of a friend-group banner upload, mirrored by a CHECK on `friend_groups.banner_url`. */
export const GROUP_BANNER_URL_PATTERN =
  /^\/media\/group-banners\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/u;

export function isGroupBannerUrl(url: string): boolean {
  return GROUP_BANNER_URL_PATTERN.test(url);
}

/** Pixels. */
export const GROUP_BANNER_WIDTH = 1600;

export const GROUP_BANNER_MAX_BYTES = 20 * 1024 * 1024;

/** Percent from the top. */
export const GROUP_BANNER_DEFAULT_POSITION = 50;
