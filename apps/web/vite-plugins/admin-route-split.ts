type SplitNode =
  | "loader"
  | "component"
  | "pendingComponent"
  | "errorComponent"
  | "notFoundComponent";

const ADMIN_ROUTE_ID = "/_app/_authenticated/admin";

// Error and pending components stay inline: they are tiny and must render before any chunk loads.
export function adminRouteSplitBehavior({
  routeId,
}: {
  routeId: string;
}): SplitNode[][] | undefined {
  if (routeId !== ADMIN_ROUTE_ID && !routeId.startsWith(`${ADMIN_ROUTE_ID}/`)) {
    return undefined;
  }
  return [["loader"], ["component"]];
}
