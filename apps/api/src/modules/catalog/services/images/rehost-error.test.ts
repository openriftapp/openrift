import { describe, expect, it } from "vitest";

import { DownloadError } from "./download.js";
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
    [new DownloadError({ kind: "http", status: 404 }, "Download failed (404): x"), "HTTP 404"],
    [new DownloadError({ kind: "blocked" }, "Blocked download: x"), "download blocked"],
    [new DownloadError({ kind: "not-an-image" }, "not an image: x"), "not an image"],
    [new Error("Input buffer contains unsupported image format"), "not an image"],
    [new DownloadError({ kind: "too-large" }, "larger than: x"), "file too large"],
    [new DownloadError({ kind: "redirect" }, "too many redirects: x"), "redirect failed"],
    [new DownloadError({ kind: "timeout" }, "timed out: x"), "timeout"],
    [new DownloadError({ kind: "connection" }, "connection failed: x"), "connection failed"],
    [Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }), "timeout"],
    [withCode("getaddrinfo ENOTFOUND cdn.example.com", "ENOTFOUND"), "connection failed"],
    ["something odd", "could not process the image"],
  ])("maps %s to %s", (error, reason) => {
    expect(rehostFailureReason(error)).toBe(reason);
  });

  it("never echoes a server path or a URL", () => {
    const reasons = [
      withCode("ENOENT: no such file or directory, open '/home/app/media/x.png'", "ENOENT"),
      new DownloadError(
        { kind: "http", status: 500 },
        "Download failed (500): https://cdn.example.com/x.png",
      ),
      new Error("EACCES: permission denied, mkdir '/srv/media/cards/ab'"),
    ].map((error) => rehostFailureReason(error));

    for (const reason of reasons) {
      expect(reason).not.toMatch(/\/|https?:/u);
    }
  });

  it("ignores words in a download URL", () => {
    const error = new DownloadError(
      { kind: "http", status: 403 },
      "Download failed (403): https://cdn.example.com/timeout/redirect/corrupt.png",
    );
    expect(rehostFailureReason(error)).toBe("HTTP 403");
  });
});
