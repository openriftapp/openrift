// html2canvas-pro reads clip-path polygons but not em/calc units; resolve
// those to percentages before capture.
function resolveClipPaths(element: HTMLElement): void {
  const inlineClip = element.style.clipPath;
  if (
    inlineClip &&
    inlineClip.includes("polygon") &&
    (inlineClip.includes("em") || inlineClip.includes("calc"))
  ) {
    const computed = getComputedStyle(element).clipPath;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (width > 0 && height > 0 && computed.includes("polygon")) {
      const converted = computed.replaceAll(/[\d.]+px/gu, (match, offset) => {
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- match includes the "px" unit; Number() would yield NaN
        const px = Number.parseFloat(match);
        const before = computed.slice(computed.indexOf("(") + 1, offset);
        const valueIndex = before.split(/[\s,]+/u).filter(Boolean).length;
        const isX = valueIndex % 2 === 0;
        const percent = isX ? (px / width) * 100 : (px / height) * 100;
        return `${percent.toFixed(1)}%`;
      });
      element.style.clipPath = converted;
    }
  }
  for (const child of element.children) {
    if (child instanceof HTMLElement) {
      resolveClipPaths(child);
    }
  }
}

export function waitForRender(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wrapping requestAnimationFrame callback API
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Loads html2canvas-pro on demand: a static import would put it on every deck tile's page. */
export async function captureElementCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  resolveClipPaths(element);
  const { html2canvas } = await import("html2canvas-pro");
  return html2canvas(element, {
    width: element.offsetWidth,
    height: element.offsetHeight,
    scale: 2,
    useCORS: true,
    backgroundColor: null,
  });
}
