// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import type { BeforeInstallPromptEvent } from "./install-store";
import { initInstallPromptCapture, useInstallStore } from "./install-store";

function fakePromptEvent(outcome: "accepted" | "dismissed"): BeforeInstallPromptEvent {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
}

describe("install-store", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useInstallStore);
  });

  afterEach(() => {
    resetStore();
  });

  it("counts each visit day once", () => {
    const { recordVisit } = useInstallStore.getState();
    recordVisit("2026-09-20");
    recordVisit("2026-09-20");
    recordVisit("2026-09-21");
    expect(useInstallStore.getState().visitDays).toBe(2);
    expect(useInstallStore.getState().lastVisitDay).toBe("2026-09-21");
  });

  it("reports unavailable when no prompt was captured", async () => {
    await expect(useInstallStore.getState().promptInstall()).resolves.toBe("unavailable");
  });

  it("shows the captured prompt once and returns the user's choice", async () => {
    const event = fakePromptEvent("accepted");
    useInstallStore.getState().setPromptEvent(event);

    await expect(useInstallStore.getState().promptInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(useInstallStore.getState().promptEvent).toBeNull();
  });

  it("captures the browser event and suppresses the default banner", () => {
    const target = new EventTarget();
    initInstallPromptCapture(target);
    const event = fakePromptEvent("dismissed");

    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(useInstallStore.getState().promptEvent).toBe(event);
  });

  it("drops the captured prompt once the app is installed", () => {
    const target = new EventTarget();
    initInstallPromptCapture(target);
    target.dispatchEvent(fakePromptEvent("accepted"));

    target.dispatchEvent(new Event("appinstalled"));

    expect(useInstallStore.getState().promptEvent).toBeNull();
  });

  it("persists only the visit and dismissal fields", () => {
    useInstallStore.getState().setPromptEvent(fakePromptEvent("accepted"));
    const partialize = useInstallStore.persist.getOptions().partialize!;
    expect(Object.keys(partialize(useInstallStore.getState())).toSorted()).toEqual([
      "installedToastShown",
      "lastVisitDay",
      "nudgeDismissed",
      "visitDays",
    ]);
  });

  it("merge ignores malformed persisted values", () => {
    const merge = useInstallStore.persist.getOptions().merge!;
    const current = useInstallStore.getState();
    const merged = merge(
      { visitDays: "3", lastVisitDay: 7, nudgeDismissed: "yes", installedToastShown: true },
      current,
    );
    expect(merged.visitDays).toBe(0);
    expect(merged.lastVisitDay).toBeNull();
    expect(merged.nudgeDismissed).toBe(false);
    expect(merged.installedToastShown).toBe(true);
  });
});
