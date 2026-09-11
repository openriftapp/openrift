import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { groupNudgeKey, useOnboardingStore } from "./onboarding-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useOnboardingStore);
});

afterEach(() => {
  resetStore();
});

describe("useOnboardingStore", () => {
  it("starts with the deck-builder intro un-dismissed", () => {
    expect(useOnboardingStore.getState().deckBuilderIntroDismissed).toBe(false);
  });

  it("dismisses the deck-builder intro when called", () => {
    useOnboardingStore.getState().dismissDeckBuilderIntro();
    expect(useOnboardingStore.getState().deckBuilderIntroDismissed).toBe(true);
  });

  it("starts with the collection intro un-dismissed", () => {
    expect(useOnboardingStore.getState().collectionIntroDismissed).toBe(false);
  });

  it("dismisses the collection intro when called", () => {
    useOnboardingStore.getState().dismissCollectionIntro();
    expect(useOnboardingStore.getState().collectionIntroDismissed).toBe(true);
  });

  it("starts with the missing-images nudge un-dismissed", () => {
    expect(useOnboardingStore.getState().dismissedMissingImagePrintings).toEqual([]);
  });

  it("records the dismissed printings when called", () => {
    useOnboardingStore.getState().dismissMissingImagesNudge(["p-1", "p-2"]);
    expect(useOnboardingStore.getState().dismissedMissingImagePrintings).toEqual(["p-1", "p-2"]);
  });

  it("replaces the dismissed printings on a later dismissal", () => {
    useOnboardingStore.getState().dismissMissingImagesNudge(["p-1", "p-2"]);
    useOnboardingStore.getState().dismissMissingImagesNudge(["p-2", "p-3"]);
    expect(useOnboardingStore.getState().dismissedMissingImagePrintings).toEqual(["p-2", "p-3"]);
  });

  it("keeps the missing-images nudge separate from the collection intro", () => {
    useOnboardingStore.getState().dismissMissingImagesNudge(["p-1"]);
    expect(useOnboardingStore.getState().collectionIntroDismissed).toBe(false);
  });

  it("keeps the intros independent", () => {
    useOnboardingStore.getState().dismissCollectionIntro();
    expect(useOnboardingStore.getState().deckBuilderIntroDismissed).toBe(false);
  });

  describe("intros", () => {
    it("starts with nothing dismissed", () => {
      expect(useOnboardingStore.getState().dismissedIntros).toEqual([]);
    });

    it("records a dismissal under its key", () => {
      useOnboardingStore.getState().dismissIntro("tier-list");
      expect(useOnboardingStore.getState().dismissedIntros).toEqual(["tier-list"]);
    });

    it("keeps intros independent", () => {
      useOnboardingStore.getState().dismissIntro("stage");
      expect(useOnboardingStore.getState().dismissedIntros).not.toContain("list");
    });

    it("does not duplicate a repeated dismissal", () => {
      useOnboardingStore.getState().dismissIntro("list");
      useOnboardingStore.getState().dismissIntro("list");
      expect(useOnboardingStore.getState().dismissedIntros).toEqual(["list"]);
    });
  });

  describe("group nudges", () => {
    it("starts with nothing dismissed", () => {
      expect(useOnboardingStore.getState().dismissedGroupNudges).toEqual([]);
    });

    it("records a dismissal under the group and kind", () => {
      useOnboardingStore.getState().dismissGroupNudge("bothfeld", "contacts");
      expect(useOnboardingStore.getState().dismissedGroupNudges).toEqual(["bothfeld:contacts"]);
    });

    it("keeps the same nudge separate per group", () => {
      useOnboardingStore.getState().dismissGroupNudge("bothfeld", "lists");
      useOnboardingStore.getState().dismissGroupNudge("cube-night", "lists");
      expect(useOnboardingStore.getState().dismissedGroupNudges).toEqual([
        "bothfeld:lists",
        "cube-night:lists",
      ]);
    });

    it("does not duplicate a repeated dismissal", () => {
      useOnboardingStore.getState().dismissGroupNudge("bothfeld", "contacts");
      useOnboardingStore.getState().dismissGroupNudge("bothfeld", "contacts");
      expect(useOnboardingStore.getState().dismissedGroupNudges).toEqual(["bothfeld:contacts"]);
    });

    it("builds the key from the slug and kind", () => {
      expect(groupNudgeKey("bothfeld", "lists")).toBe("bothfeld:lists");
    });
  });

  describe("persistence merge", () => {
    it("rejects non-boolean dismiss values and keeps current", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { deckBuilderIntroDismissed: "yes" };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.deckBuilderIntroDismissed).toBe(current.deckBuilderIntroDismissed);
      }
    });

    it("accepts a true boolean from persisted storage", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { deckBuilderIntroDismissed: true };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.deckBuilderIntroDismissed).toBe(true);
      }
    });

    it("falls back to current state when persisted blob is missing the key", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.({}, current);
      if (result) {
        expect(result.deckBuilderIntroDismissed).toBe(current.deckBuilderIntroDismissed);
        expect(result.collectionIntroDismissed).toBe(current.collectionIntroDismissed);
        expect(result.dismissedMissingImagePrintings).toEqual(
          current.dismissedMissingImagePrintings,
        );
      }
    });

    it("keeps the missing-images nudge when an older persisted blob omits it", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { collectionIntroDismissed: true, dismissedGroupNudges: [] };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.collectionIntroDismissed).toBe(true);
        expect(result.dismissedMissingImagePrintings).toEqual([]);
      }
    });

    it("accepts persisted missing-image dismissals", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedMissingImagePrintings: ["p-1", "p-2"] };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedMissingImagePrintings).toEqual(["p-1", "p-2"]);
      }
    });

    it("drops non-string entries from the persisted missing-image dismissals", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedMissingImagePrintings: ["p-1", 7, null] };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedMissingImagePrintings).toEqual(["p-1"]);
      }
    });

    it("rejects a non-array missing-images value and keeps current", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedMissingImagePrintings: "yes" };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedMissingImagePrintings).toEqual(
          current.dismissedMissingImagePrintings,
        );
      }
    });

    it("accepts a persisted collection-intro dismissal", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { collectionIntroDismissed: true };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.collectionIntroDismissed).toBe(true);
      }
    });

    it("rejects a non-boolean collection-intro value and keeps current", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { collectionIntroDismissed: "yes" };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.collectionIntroDismissed).toBe(current.collectionIntroDismissed);
      }
    });

    it("accepts persisted intro dismissals and drops unknown keys", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedIntros: ["stage", "retired-intro", 3] };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedIntros).toEqual(["stage"]);
      }
    });

    it("keeps current intro dismissals when the persisted value isn't an array", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedIntros: "stage" };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedIntros).toEqual(current.dismissedIntros);
      }
    });

    it("accepts persisted group-nudge dismissals and drops non-string entries", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedGroupNudges: ["bothfeld:contacts", 7, null] };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedGroupNudges).toEqual(["bothfeld:contacts"]);
      }
    });

    it("keeps current group-nudge dismissals when the persisted value isn't an array", () => {
      const store = useOnboardingStore;
      const current = store.getState();
      const persisted = { dismissedGroupNudges: "bothfeld:contacts" };
      const merge = store.persist?.getOptions()?.merge;
      const result = merge?.(persisted, current);
      if (result) {
        expect(result.dismissedGroupNudges).toEqual(current.dismissedGroupNudges);
      }
    });
  });
});
