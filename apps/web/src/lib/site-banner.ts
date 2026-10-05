export type SiteBannerKind = "locale" | "milestone" | "install";

export function pickSiteBanner(visible: Record<SiteBannerKind, boolean>): SiteBannerKind | null {
  if (visible.locale) {
    return "locale";
  }
  if (visible.milestone) {
    return "milestone";
  }
  if (visible.install) {
    return "install";
  }
  return null;
}
