import { describe, expect, it } from "vitest";

import { watchPage } from "./page-watch";

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

describe("watchPage", () => {
  it("repaints once per host change even when the painter rewrites equal text", async () => {
    document.body.innerHTML = '<div id="host"></div><span id="own"></span>';
    const own = document.querySelector("#own");
    let paints = 0;
    const watch = watchPage(
      document.body,
      () => {
        paints += 1;
        if (paints < 5 && own !== null) {
          own.textContent = "2";
        }
      },
      (run) => {
        run();
      },
    );

    document.querySelector("#host")?.append(document.createElement("p"));
    await settle();

    expect(paints).toBe(1);
    watch.stop();
  });

  it("does not repaint for its own direct repaint", async () => {
    document.body.innerHTML = '<span id="own"></span>';
    let scheduled = 0;
    const watch = watchPage(
      document.body,
      () => {
        document.querySelector("#own")?.replaceChildren("x");
      },
      () => {
        scheduled += 1;
      },
    );

    watch.repaint();
    await settle();

    expect(scheduled).toBe(0);
    watch.stop();
  });

  it("still sees what the host changes from inside the after-paint step", async () => {
    document.body.innerHTML = '<div id="host"></div>';
    let scheduled = 0;
    const watch = watchPage(
      document.body,
      () => {},
      () => {
        scheduled += 1;
      },
      () => {
        document.querySelector("#host")?.append(document.createElement("p"));
      },
    );

    watch.repaint();
    await settle();

    expect(scheduled).toBe(1);
    watch.stop();
  });

  it("stops reacting once stopped", async () => {
    document.body.innerHTML = '<div id="host"></div>';
    let scheduled = 0;
    const watch = watchPage(
      document.body,
      () => {},
      () => {
        scheduled += 1;
      },
    );

    watch.stop();
    document.querySelector("#host")?.append(document.createElement("p"));
    await settle();

    expect(scheduled).toBe(0);
  });
});
