// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVOKE_DELAY_MS,
  downloadBlob,
  downloadCsv,
  downloadJson,
  downloadText,
  downloadUrl,
  safeFilename,
} from "./download";

const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

let anchors: HTMLAnchorElement[] = [];
let blobs: Blob[] = [];
let attachedOnClick: boolean[] = [];

beforeEach(() => {
  anchors = [];
  blobs = [];
  attachedOnClick = [];
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
  createObjectURL.mockImplementation((blob) => {
    blobs.push(blob);
    return `blob:openrift/${blobs.length}`;
  });
  // jsdom implements neither, and a real click would try to navigate.
  vi.stubGlobal("URL", Object.assign(globalThis.URL, { createObjectURL, revokeObjectURL }));

  // oxlint-disable-next-line typescript/no-deprecated -- a bare method reference resolves to the deprecated legacy-tag overload
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const element = realCreateElement(tag);
    if (tag === "a") {
      const anchor = element as HTMLAnchorElement;
      vi.spyOn(anchor, "click").mockImplementation(() => {
        attachedOnClick.push(anchor.isConnected);
      });
      anchors.push(anchor);
    }
    return element;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadUrl", () => {
  it("clicks an anchor attached to the document, then removes it", () => {
    downloadUrl("data:image/png;base64,AAAA", "deck-qr.png");

    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.href).toBe("data:image/png;base64,AAAA");
    expect(anchors[0]!.download).toBe("deck-qr.png");
    expect(attachedOnClick).toEqual([true]);
    expect(anchors[0]!.isConnected).toBe(false);
  });
});

describe("downloadBlob", () => {
  it("downloads through an object URL", () => {
    downloadBlob(new Blob(["x"]), "card.png");

    expect(anchors[0]!.href).toBe("blob:openrift/1");
    expect(anchors[0]!.click).toHaveBeenCalledOnce();
  });

  it("releases the object URL only after the download has had time to start", () => {
    vi.useFakeTimers();
    downloadBlob(new Blob([]), "empty.bin");

    vi.advanceTimersByTime(REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:openrift/1");
  });
});

describe("downloadText", () => {
  it("downloads the text verbatim with the given type and filename", async () => {
    downloadText('{"a":1}', "application/json", "cards-export-2026-08-15.json");

    expect(anchors[0]!.download).toBe("cards-export-2026-08-15.json");
    expect(blobs[0]!.type).toBe("application/json");
    await expect(blobs[0]!.text()).resolves.toBe('{"a":1}');
  });

  it("downloads empty text rather than skipping the download", async () => {
    downloadText("", "application/json", "empty.json");

    expect(anchors[0]!.click).toHaveBeenCalledOnce();
    await expect(blobs[0]!.text()).resolves.toBe("");
  });
});

describe("downloadJson", () => {
  it("serializes the value pretty-printed", async () => {
    downloadJson({ name: "Summoner Skirmish", rounds: [1, 2] }, "event.json");

    await expect(blobs[0]!.text()).resolves.toBe(
      '{\n  "name": "Summoner Skirmish",\n  "rounds": [\n    1,\n    2\n  ]\n}',
    );
    expect(blobs[0]!.type).toBe("application/json");
    expect(anchors[0]!.download).toBe("event.json");
  });

  it("handles an empty array", async () => {
    downloadJson([], "none.json");

    await expect(blobs[0]!.text()).resolves.toBe("[]");
  });
});

describe("downloadCsv", () => {
  it("downloads UTF-8 CSV", async () => {
    downloadCsv("name\nJinx", "collection.csv");

    expect(blobs[0]!.type).toBe("text/csv;charset=utf-8");
    await expect(blobs[0]!.text()).resolves.toBe("name\nJinx");
    expect(anchors[0]!.download).toBe("collection.csv");
  });
});

describe("safeFilename", () => {
  it("keeps word characters, spaces and dashes", () => {
    expect(safeFilename("Jinx Aggro - v2", "deck")).toBe("Jinx Aggro - v2");
  });

  it("replaces unsafe runs with an underscore", () => {
    expect(safeFilename("Ahri/Lux: final?", "deck")).toBe("Ahri_Lux_ final_");
  });

  it("trims surrounding whitespace", () => {
    expect(safeFilename("  Summoner Skirmish  ", "deck")).toBe("Summoner Skirmish");
  });

  it("falls back when nothing usable remains", () => {
    expect(safeFilename("   ", "qr-code")).toBe("qr-code");
    expect(safeFilename("", "image")).toBe("image");
  });
});
