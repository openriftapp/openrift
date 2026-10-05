import { afterEach, describe, expect, it, vi } from "vitest";

import { isApiError } from "./api-error";
import { postMultipart } from "./upload";

function stubFetch(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { origin: "https://openrift.test" });
  return fetchMock;
}

const messageForStatus = (status: number) => (status === 413 ? "Too large" : "Upload failed");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postMultipart", () => {
  it("POSTs the form data to the same-origin API path with credentials", async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ url: "/media/a.webp" }),
    });
    const body = new FormData();
    body.append("file", new Blob(["x"]), "banner.png");

    const result = await postMultipart<{ url: string }>("/api/v1/uploads", body, {
      messageForStatus,
    });

    expect(result).toEqual({ url: "/media/a.webp" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrift.test/api/v1/uploads");
    expect(init).toMatchObject({ method: "POST", body, credentials: "include" });
  });

  it("throws an ApiError carrying the status-specific message", async () => {
    stubFetch({ ok: false, status: 413 });

    const thrown: unknown = await postMultipart("/api/v1/uploads", new FormData(), {
      messageForStatus,
    }).catch((error: unknown) => error);

    expect(isApiError(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      message: "Too large",
      status: 413,
      diagnostic: "POST /api/v1/uploads → 413",
    });
  });

  it("uses the fallback message for an unmapped status", async () => {
    stubFetch({ ok: false, status: 500 });

    await expect(
      postMultipart("/api/v1/uploads", new FormData(), { messageForStatus }),
    ).rejects.toThrow("Upload failed");
  });
});
