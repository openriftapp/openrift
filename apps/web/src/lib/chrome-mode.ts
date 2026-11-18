import type { StaticDataRouteOption } from "@tanstack/react-router";

export type ChromeMode = NonNullable<StaticDataRouteOption["chrome"]>;

/** The deepest match that declares a chrome mode wins. */
export function routeChromeMode(
  matches: readonly { staticData?: StaticDataRouteOption }[],
): ChromeMode | undefined {
  return matches.findLast((match) => match.staticData?.chrome !== undefined)?.staticData?.chrome;
}
