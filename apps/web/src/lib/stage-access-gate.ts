const STAGE_PATH = "/stage";
const STAGE_SHOW_PATH = "/stage/show";

interface StageLocation {
  pathname: string;
  search: Record<string, unknown>;
}

export function isStageTierPath(location: StageLocation): boolean {
  return location.pathname === STAGE_SHOW_PATH && typeof location.search.tier === "string";
}

function namesSource(search: Record<string, unknown>): boolean {
  return (
    typeof search.deck === "string" ||
    typeof search.tier === "string" ||
    typeof search.tierShare === "string"
  );
}

function namesQueue(search: Record<string, unknown>): boolean {
  const { cards } = search;
  return (
    Array.isArray(cards) &&
    cards.length > 0 &&
    cards.every((card: unknown) => typeof card === "string")
  );
}

/**
 * Where a stage URL belongs when it names the other half: a `/stage` link in the
 * shape older bookmarks carry opens the show, a show with nothing to present opens the builder.
 */
export function stageRedirectHref(
  location: StageLocation & { searchStr: string },
): string | undefined {
  const { pathname, search, searchStr } = location;
  if (
    pathname === STAGE_PATH &&
    (namesSource(search) || (namesQueue(search) && search.edit !== true))
  ) {
    return `${STAGE_SHOW_PATH}${searchStr}`;
  }
  if (pathname === STAGE_SHOW_PATH && !namesSource(search) && !namesQueue(search)) {
    return `${STAGE_PATH}${searchStr}`;
  }
  return undefined;
}
