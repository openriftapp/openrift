interface PageLocation {
  origin: string;
  pathname: string;
  search: string;
}

export function ruleLinkUrl(ruleNumber: string, location: PageLocation): string {
  const lang = new URLSearchParams(location.search).get("lang");
  const search = lang === null ? "" : `?lang=${encodeURIComponent(lang)}`;
  return `${location.origin}${location.pathname}${search}#rule-${ruleNumber}`;
}
