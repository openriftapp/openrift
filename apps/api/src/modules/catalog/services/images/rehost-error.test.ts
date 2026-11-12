import { describe, expect, it } from "vitest";

import { rehostFailureReason } from "./rehost-error.js";

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe("rehostFailureReason", () => {
  it.each([
    [
      withCode("ENOENT: no such file or directory, open '/home/app/media/x.png'", "ENOENT"),
      "file not found",
    ],
    [new Error("Download failed (404): https://cdn.example.com/x.png"), "HTTP 404"],
    [new Error("Blocked download (private address): http://10.0.0.1/x.png"), "download blocked"],
    [
      new Error("Download failed (not an image: text/html): https://cdn.example.com/x"),
      "not an image",
    ],
    [new Error("Input buffer contains unsupported image format"), "not an image"],
    [new Error("Download failed (larger than 52428800 bytes): https://x.test/a"), "file too large"],
    [new Error("Download failed (too many redirects): https://x.test/a"), "redirect failed"],
    [Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }), "timeout"],
    [
      Object.assign(new TypeError("fetch failed"), { cause: withCode("connect", "ECONNREFUSED") }),
      "connection failed",
    ],
    ["something odd", "could not process the image"],
  ])("maps %s to %s", (error, reason) => {
    expect(rehostFailureReason(error)).toBe(reason);
  });

  it("never echoes a server path or a URL", () => {
    const reasons = [
      withCode("ENOENT: no such file or directory, open '/home/app/media/x.png'", "ENOENT"),
      new Error("Download failed (500): https://cdn.example.com/x.png"),
      new Error("EACCES: permission denied, mkdir '/srv/media/cards/ab'"),
    ].map((error) => rehostFailureReason(error));

    for (const reason of reasons) {
      expect(reason).not.toMatch(/\/|https?:/u);
    }
  });
});
