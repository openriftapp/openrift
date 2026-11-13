import { useSuspenseQuery } from "@tanstack/react-query";

import { siteSettingsQueryOptions } from "@/lib/site-settings";

export function useSiteSettingValue(key: string): string | undefined {
  const { data } = useSuspenseQuery(siteSettingsQueryOptions);
  return data[key];
}
