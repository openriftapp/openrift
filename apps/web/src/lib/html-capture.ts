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

async function assetsReady(element: HTMLElement): Promise<void> {
  // A broken image still captures (as its fallback or nothing); it must not stall the export.
  await Promise.all(
    [...element.querySelectorAll("img")].map((image) => image.decode().catch(() => null)),
  );
  await document.fonts.ready;
}

export interface RenderHandoff {
  /** Ref callback for the element rendered for `key`. */
  report: (key: string, element: HTMLElement | null) => (() => void) | undefined;
  /** Resolves with the element rendered for `key` once its images are decoded and fonts loaded. */
  waitFor: (key: string) => Promise<HTMLElement>;
}

export function createRenderHandoff(): RenderHandoff {
  const mounted = new Map<string, HTMLElement>();
  const waiters = new Map<string, (element: HTMLElement) => void>();
  return {
    report: (key, element) => {
      if (element === null) {
        return;
      }
      mounted.set(key, element);
      waiters.get(key)?.(element);
      waiters.delete(key);
      return () => {
        if (mounted.get(key) === element) {
          mounted.delete(key);
        }
      };
    },
    waitFor: async (key) => {
      const element =
        mounted.get(key) ??
        // oxlint-disable-next-line promise/avoid-new -- resolved by the ref callback of the element rendered for this key
        (await new Promise<HTMLElement>((resolve) => {
          waiters.set(key, resolve);
        }));
      await assetsReady(element);
      return element;
    },
  };
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
