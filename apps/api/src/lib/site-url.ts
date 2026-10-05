export function siteHostFromOrigin(siteOrigin?: string): string | undefined {
  if (!siteOrigin) {
    return undefined;
  }
  try {
    return new URL(siteOrigin).host || undefined;
  } catch {
    return undefined;
  }
}

export function shareUrlFromOrigin(
  siteOrigin: string | undefined,
  path: string,
): string | undefined {
  return siteOrigin ? `${siteOrigin}${path}` : undefined;
}
