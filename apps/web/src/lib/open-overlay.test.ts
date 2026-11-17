// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { openOverlayPresent } from "./open-overlay";

function append(role: string, wrapperAttribute?: string) {
  const element = document.createElement("div");
  element.setAttribute("role", role);
  if (wrapperAttribute === undefined) {
    document.body.append(element);
    return element;
  }
  const wrapper = document.createElement("div");
  wrapper.setAttribute(wrapperAttribute, "");
  wrapper.append(element);
  document.body.append(wrapper);
  return wrapper;
}

describe("openOverlayPresent", () => {
  it("counts a dialog that carries no open state", () => {
    const dialog = append("dialog");
    expect(openOverlayPresent()).toBe(true);
    dialog.remove();
  });

  it("skips overlays under a closed, inert or hidden popup", () => {
    const closed = [
      append("listbox", "data-closed"),
      append("menu", "inert"),
      append("dialog", "hidden"),
    ];
    expect(openOverlayPresent()).toBe(false);
    for (const element of closed) {
      element.remove();
    }
  });
});
