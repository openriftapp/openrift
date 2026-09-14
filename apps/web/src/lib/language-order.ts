/** Non-hook language order for route loaders and server functions; `useEffectiveLanguageOrder` is the hook form. */
export function effectiveLanguageOrder(
  userLanguages: readonly string[],
  defaultLanguageRows: readonly { slug: string; sortOrder: number }[],
): readonly string[] {
  if (userLanguages.length > 0) {
    return userLanguages;
  }
  return defaultLanguageRows.toSorted((a, b) => a.sortOrder - b.sortOrder).map((row) => row.slug);
}
