import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubCopy } from "@/test/factories";

import { fetchCopies } from "./copies-query";

interface Asked {
  cursor: string | null;
  deltaCursor: string | null;
  since: string | null;
}

let asked: Asked[];
let respond: (query: Asked) => unknown;

beforeEach(() => {
  asked = [];
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Request) => {
      const url = new URL(input.url);
      const query = {
        cursor: url.searchParams.get("cursor"),
        deltaCursor: url.searchParams.get("deltaCursor"),
        since: url.searchParams.get("since"),
      };
      asked.push(query);
      return Promise.resolve(Response.json(respond(query), { status: 200 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCopies over a paged full read", () => {
  it("keeps the first page's watermark, so a write during paging is not skipped", async () => {
    respond = (query) =>
      query.cursor === null
        ? {
            items: [stubCopy({ id: "c1" })],
            nextCursor: "page-2",
            syncedXid: "1000",
          }
        : { items: [stubCopy({ id: "c2" })], nextCursor: null, syncedXid: "9000" };

    const result = await fetchCopies();

    expect(result.items.map((row) => row.id)).toEqual(["c1", "c2"]);
    expect(result.syncedXid).toBe("1000");
  });
});

describe("fetchCopies over a delta", () => {
  it("drains every page before reporting a watermark", async () => {
    respond = (query) =>
      query.deltaCursor === null
        ? {
            items: [stubCopy({ id: "c1" })],
            nextCursor: null,
            deletedIds: ["gone-1"],
            nextDeltaCursor: "5000~4001_c1~",
          }
        : {
            items: [stubCopy({ id: "c2" })],
            nextCursor: null,
            deletedIds: ["gone-2"],
            nextDeltaCursor: null,
            syncedXid: "5000",
          };

    const result = await fetchCopies("1000");

    expect(result.items.map((row) => row.id)).toEqual(["c1", "c2"]);
    expect(result.deletedIds).toEqual(["gone-1", "gone-2"]);
    expect(result.syncedXid).toBe("5000");
  });

  it("sends the cursor back so the next page resumes where the last stopped", async () => {
    respond = (query) =>
      query.deltaCursor === null
        ? { items: [], nextCursor: null, deletedIds: [], nextDeltaCursor: "5000~4001_c1~" }
        : { items: [], nextCursor: null, deletedIds: [], nextDeltaCursor: null, syncedXid: "5000" };

    await fetchCopies("1000");

    expect(asked).toHaveLength(2);
    expect(asked[1]?.deltaCursor).toBe("5000~4001_c1~");
    expect(asked[1]?.since).toBe("1000");
  });

  it("restarts as a full read when the sweep makes the server fall back mid-read", async () => {
    respond = (query) =>
      query.deltaCursor === null && query.cursor === null
        ? {
            items: [stubCopy({ id: "stale" })],
            nextCursor: null,
            deletedIds: ["gone-1"],
            nextDeltaCursor: "5000~4001_stale~",
          }
        : { items: [stubCopy({ id: "c1" })], nextCursor: null, syncedXid: "7000" };

    const result = await fetchCopies("1000");

    expect(result.items.map((row) => row.id)).toEqual(["c1"]);
    expect(result.deletedIds).toBeUndefined();
    expect(result.syncedXid).toBe("7000");
  });

  it("leaves the watermark alone when the server withholds one", async () => {
    respond = () => ({ items: [], nextCursor: null, deletedIds: [], nextDeltaCursor: null });

    const result = await fetchCopies("1000");

    expect(result.syncedXid).toBeUndefined();
  });
});
