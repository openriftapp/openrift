import { describe, expect, it } from "vitest";

import { upsertMirrorRows } from "./mirror-upsert.js";

interface Row {
  id: string;
  hash: string;
}

function fakeTable(stored: Record<string, string>) {
  const writes: Row[][] = [];
  const touched: string[][] = [];
  return {
    writes,
    touched,
    spec: {
      keyOf: (row: Row) => row.id,
      write: (batch: Row[]) => {
        writes.push(batch);
        const out = batch
          .filter((row) => stored[row.id] !== row.hash)
          .map((row) => ({ key: row.id, inserted: stored[row.id] === undefined }));
        return Promise.resolve(out);
      },
      touch: (keys: string[]) => {
        touched.push(keys);
        return Promise.resolve();
      },
    },
  };
}

describe("upsertMirrorRows", () => {
  it("writes rows in key order, whatever order the source listed them in", async () => {
    const table = fakeTable({});

    await upsertMirrorRows(
      [
        { id: "c", hash: "1" },
        { id: "a", hash: "1" },
        { id: "b", hash: "1" },
      ],
      table.spec,
    );

    expect(table.writes.flat().map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the last row of a key listed twice, so one statement never updates a row twice", async () => {
    const table = fakeTable({});

    const result = await upsertMirrorRows(
      [
        { id: "a", hash: "old" },
        { id: "a", hash: "new" },
      ],
      table.spec,
    );

    expect(table.writes.flat()).toEqual([{ id: "a", hash: "new" }]);
    expect(result.inserted).toEqual(["a"]);
  });

  it("splits inserted, changed and unchanged rows and stamps only the unchanged ones", async () => {
    const table = fakeTable({ b: "same", c: "before" });

    const result = await upsertMirrorRows(
      [
        { id: "a", hash: "x" },
        { id: "b", hash: "same" },
        { id: "c", hash: "after" },
      ],
      table.spec,
    );

    expect(result).toEqual({ inserted: ["a"], changed: ["c"], unchanged: ["b"] });
    expect(table.touched).toEqual([["b"]]);
  });

  it("stamps the unchanged rows in key order too", async () => {
    const table = fakeTable({ c: "same", a: "same", b: "same" });

    const result = await upsertMirrorRows(
      [
        { id: "c", hash: "same" },
        { id: "a", hash: "same" },
        { id: "b", hash: "same" },
      ],
      table.spec,
    );

    expect(result.unchanged).toEqual(["a", "b", "c"]);
    expect(table.touched).toEqual([["a", "b", "c"]]);
  });

  it("touches nothing for an empty listing", async () => {
    const table = fakeTable({});

    expect(await upsertMirrorRows([], table.spec)).toEqual({
      inserted: [],
      changed: [],
      unchanged: [],
    });
    expect(table.writes).toEqual([]);
    expect(table.touched).toEqual([]);
  });
});
