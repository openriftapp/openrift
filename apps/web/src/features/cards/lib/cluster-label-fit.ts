/**
 * `expandedClusterWidths` must come from a measuring strip that always renders labels.
 * Live cluster widths make the expanded/collapsed decision oscillate.
 */
export function clusterLabelsFit({
  containerWidth,
  childWidths,
  expandedClusterWidths,
  gap,
  buffer,
}: {
  containerWidth: number;
  childWidths: readonly number[];
  expandedClusterWidths: readonly number[];
  gap: number;
  buffer: number;
}): boolean {
  const widths = [...childWidths, ...expandedClusterWidths];
  if (widths.length === 0) {
    return true;
  }
  const required =
    widths.reduce((total, width) => total + width, 0) + gap * (widths.length - 1) + buffer;
  return required <= containerWidth;
}

/**
 * Base UI parks position:fixed focus guards and hidden inputs next to an open popup's trigger.
 * Counting them collapses the labels the moment a menu opens.
 */
export function occupiesRowWidth(element: Element): boolean {
  const position = element.ownerDocument.defaultView?.getComputedStyle(element).position;
  return position !== "absolute" && position !== "fixed";
}
