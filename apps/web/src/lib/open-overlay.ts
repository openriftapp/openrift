const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

// BaseUI keeps a closed popup mounted under `data-closed`, `inert` or `hidden`.
const CLOSED_SELECTOR = "[data-closed], [inert], [hidden]";

export function openOverlayPresent(): boolean {
  return [...document.querySelectorAll(OVERLAY_SELECTOR)].some(
    (element) => element.closest(CLOSED_SELECTOR) === null,
  );
}
