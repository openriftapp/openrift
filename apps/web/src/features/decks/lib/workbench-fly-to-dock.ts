import type { DeckZone } from "@openrift/shared/types/enums";

const DURATION_MS = 420;
const LANDING_MS = 260;

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function visible(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.getBoundingClientRect().width > 0;
}

function zoneSection(zone: DeckZone): Element | null {
  return document.querySelector(`[data-slot="deck-zone"][data-zone="${CSS.escape(zone)}"]`);
}

function cardRow(cardId: string, zone: DeckZone): Element | null {
  return zoneSection(zone)?.querySelector(`[data-deck-card-id="${CSS.escape(cardId)}"]`) ?? null;
}

function landingTarget(cardId: string, zone: DeckZone): HTMLElement | null {
  const dock = document.querySelector("[data-deck-dock-target] > *");
  if (visible(dock)) {
    return dock;
  }
  const row = cardRow(cardId, zone);
  if (visible(row)) {
    return row;
  }
  const section = zoneSection(zone);
  return visible(section) ? section : null;
}

export function flyCardToDeck(printingId: string, cardId: string, zone: DeckZone): void {
  if (prefersReducedMotion()) {
    return;
  }
  const image = document.querySelector<HTMLImageElement>(
    `[data-printing-id="${CSS.escape(printingId)}"] img`,
  );
  const target = landingTarget(cardId, zone);
  if (!image || !target || typeof image.animate !== "function") {
    return;
  }
  const from = image.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0) {
    return;
  }
  const ghost = image.cloneNode() as HTMLImageElement;
  ghost.removeAttribute("id");
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    borderRadius: "0.5rem",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.45)",
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.append(ghost);

  const landX = to.left + Math.min(to.width / 2, 48);
  const landY = to.top + Math.min(to.height / 2, 20);
  const dx = landX - (from.left + from.width / 2);
  const dy = landY - (from.top + from.height / 2);
  const scale = Math.max(0.08, Math.min(40, to.height) / from.height);
  const animation = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 40}px) scale(${(1 + scale) / 2}) rotate(-4deg)`,
        opacity: 1,
        offset: 0.45,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, opacity: 0.4 },
    ],
    { duration: DURATION_MS, easing: "cubic-bezier(0.45, 0, 0.2, 1)" },
  );
  // A first copy's row only exists once the add has rendered, so look it up again on landing.
  const land = () => {
    ghost.remove();
    const row = cardRow(cardId, zone);
    const pulse = visible(row) ? row : target.matches("[data-slot='deck-zone']") ? null : target;
    pulse?.animate(
      [{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }],
      { duration: LANDING_MS, easing: "ease-out" },
    );
  };
  animation.addEventListener("finish", land);
  animation.addEventListener("cancel", () => ghost.remove());
}
