export function isStageTierPath(location: {
  pathname: string;
  search: Record<string, unknown>;
}): boolean {
  return location.pathname === "/stage" && typeof location.search.tier === "string";
}
