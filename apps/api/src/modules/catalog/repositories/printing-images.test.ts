import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb, onlyStatement } from "../../../test/recording-db.js";
import { printingImagesRepo } from "./printing-images.js";

describe("printingImagesRepo", () => {
  it("landscapeImageIds keeps only images of landscape cards", async () => {
    const db = createMockDb([
      { imageFileId: "img-bf", types: ["battlefield"] },
      { imageFileId: "img-unit", types: ["unit"] },
    ]);
    expect(await printingImagesRepo(db).landscapeImageIds(["img-bf", "img-unit"])).toEqual(
      new Set(["img-bf"]),
    );
  });

  it("landscapeImageIds skips the query for no ids", async () => {
    const db = createMockDb([{ imageFileId: "img-bf", types: ["battlefield"] }]);
    expect(await printingImagesRepo(db).landscapeImageIds([])).toEqual(new Set());
  });

  it("getVariantSettingsByIds keys rotation, trim and quad by image file", async () => {
    const db = createMockDb([{ id: "ci-1", rotation: 90, needsTrim: true, quad: null }]);
    const settings = await printingImagesRepo(db).getVariantSettingsByIds(["ci-1"]);
    expect(settings.get("ci-1")).toEqual({ rotation: 90, needsTrim: true, quad: null });
  });

  it("getVariantSettingsByIds returns an empty map for empty input", async () => {
    const db = createMockDb([{ id: "ci-1", rotation: 90, needsTrim: true, quad: null }]);
    expect(await printingImagesRepo(db).getVariantSettingsByIds([])).toEqual(new Map());
  });

  it("allRehostedUrls returns URL list", async () => {
    const db = createMockDb([{ rehostedUrl: "https://cdn.example.com/img.jpg" }]);
    expect(await printingImagesRepo(db).allRehostedUrls()).toEqual([
      "https://cdn.example.com/img.jpg",
    ]);
  });
});

describe("printingImagesRepo setters skip a write that changes nothing", () => {
  it.each([["setFingerprint", "fingerprint", (repo) => repo.setFingerprint("if-1", "abc")]] as [
    string,
    string,
    (repo: ReturnType<typeof printingImagesRepo>) => Promise<void>,
  ][])("%s updates only a row whose %s differs", async (_name, column, write) => {
    const recorded = createRecordingDb();
    await write(printingImagesRepo(recorded.db));
    expect(onlyStatement(recorded).sql).toMatch(
      new RegExp(`where "id" = \\$\\d+ and "${column}" is distinct from \\$\\d+$`, "u"),
    );
  });
});

describe("replaceImageFile", () => {
  const next = {
    id: "if-new",
    rehostedUrl: "/media/cards/ew/if-new",
    rotation: 90 as const,
    needsTrim: false,
    quad: null,
  };

  it("locks the faces using the old row, then the row, moves its users, deletes it, then hands its URL to the new row", async () => {
    const recorded = createRecordingDb([
      [],
      [
        {
          original_url: "https://example.com/scan.png",
          credit: null,
        },
      ],
      [],
      [{ id: "fi-1" }],
      [],
      [],
      [],
    ]);

    expect(await printingImagesRepo(recorded.db).replaceImageFile("if-old", next)).toBe(true);
    const [faceLock, lock, insert, images, pins, deleteOld, moveUrl] = recorded.queries;
    expect(faceLock).toMatch(/^select "id" from "faces" .* order by "id" for update$/u);
    expect(lock).toMatch(/^select .* from "image_files" .* for update$/u);
    expect(insert).toMatch(/^insert into "image_files"/u);
    expect(images).toMatch(/^update "face_images" set "image_file_id"/u);
    expect(pins).toMatch(/^update "faces" set "fallback_image_file_id"/u);
    expect(deleteOld).toMatch(/^delete from "image_files"/u);
    expect(recorded.parameters[5]).toEqual(["if-old"]);
    expect(moveUrl).toMatch(/^update "image_files" set "original_url"/u);
    expect(recorded.events[0]).toBe("begin");
    expect(recorded.events.at(-1)).toBe("commit");
  });

  it("returns nothing for an old row that is already gone", async () => {
    const recorded = createRecordingDb([[], []]);
    expect(await printingImagesRepo(recorded.db).replaceImageFile("if-old", next)).toBe(false);
    expect(recorded.queries).toHaveLength(2);
  });

  it("drops the new row and keeps the old one when nothing used the old row", async () => {
    const recorded = createRecordingDb([
      [],
      [{ original_url: null, credit: null }],
      [],
      [],
      [],
      [],
    ]);
    expect(await printingImagesRepo(recorded.db).replaceImageFile("if-old", next)).toBe(false);
    expect(recorded.queries.at(-1)).toMatch(/^delete from "image_files"/u);
    expect(recorded.parameters.at(-1)).toEqual(["if-new"]);
  });
});

describe("clearRehostedUrl", () => {
  it("locks the faces using the row, then the row, re-checks it is neither live nor pinned, then clears the URL", async () => {
    const recorded = createRecordingDb([[], [{ id: "if-1" }], [], []]);

    expect(await printingImagesRepo(recorded.db).clearRehostedUrl("if-1")).toBe(true);
    expect(recorded.queries[0]).toMatch(/^select "id" from "faces" .* order by "id" for update$/u);
    expect(recorded.queries[1]).toMatch(/^select "id" from "image_files" .* for update$/u);
    expect(recorded.queries[2]).toContain('"is_active"');
    expect(recorded.queries[3]).toContain('"fallback_image_file_id"');
    expect(recorded.queries.at(-1)).toMatch(/^update "image_files" set "rehosted_url" = \$1/u);
  });

  it("refuses a file that went live after the caller's checks", async () => {
    const recorded = createRecordingDb([[], [{ id: "if-1" }], [{ id: "fi-1" }]]);

    expect(await printingImagesRepo(recorded.db).clearRehostedUrl("if-1")).toBe(false);
    expect(recorded.queries).toHaveLength(3);
  });

  it("refuses a file that is already un-rehosted", async () => {
    const recorded = createRecordingDb([[], []]);

    expect(await printingImagesRepo(recorded.db).clearRehostedUrl("if-1")).toBe(false);
    expect(recorded.queries).toHaveLength(2);
  });
});

describe("completeRehost", () => {
  it("locks the faces using the file before it writes the file", async () => {
    const recorded = createRecordingDb([[], { numAffectedRows: 1n }, [], []]);

    expect(
      await printingImagesRepo(recorded.db).completeRehost("if-1", "/media/cards/x/if-1"),
    ).toBe(true);
    expect(recorded.queries[0]).toMatch(/^select "id" from "faces" .* order by "id" for update$/u);
    expect(recorded.queries[1]).toMatch(/^update "image_files" set "rehosted_url"/u);
  });
});

describe("insertImage", () => {
  it("locks the face before it takes the file", async () => {
    const recorded = createRecordingDb([
      [{ id: "if-1" }],
      [{ face_id: "f-1" }],
      [],
      [{ rehosted_url: null }],
      [],
      [{ id: "fi-1" }],
    ]);

    expect(
      await printingImagesRepo(recorded.db).insertImage("p-1", "https://example.com/a.png"),
    ).toBe("fi-1");
    expect(recorded.queries[2]).toMatch(/^select "id" from "faces" .* for update$/u);
    expect(recorded.queries[3]).toMatch(/^select "rehosted_url" from "image_files" .* for share$/u);
  });
});
