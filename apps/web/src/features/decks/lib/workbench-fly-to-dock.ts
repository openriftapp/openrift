const DURATION_MS = 360;

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function flyCardToDock(printingId: string): void {
  if (prefersReducedMotion()) {
    return;
  }
  const image = document.querySelector<HTMLImageElement>(
    `[data-printing-id="${CSS.escape(printingId)}"] img`,
  );
  const target = document.querySelector("[data-deck-dock-target] > *");
  if (!image || !target || typeof image.animate !== "function") {
    return;
  }
  const from = image.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) {
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
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.max(0.1, to.height / from.height);
  const animation = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.2 },
    ],
    { duration: DURATION_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
  );
  const remove = () => ghost.remove();
  animation.addEventListener("finish", remove);
  animation.addEventListener("cancel", remove);
}
