import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { catalogMutationsRepo } from "./catalog-mutations.js";

describe("catalogMutationsRepo", () => {
  it("deletePrintingById returns the substitute-art pins of the faces it deleted", async () => {
    const recording = createRecordingDb([
      [
        { id: "f-1", fallback_image_file_id: "if-pinned" },
        { id: "f-2", fallback_image_file_id: null },
      ],
      [{ id: "p-1" }],
      [],
    ]);

    expect(await catalogMutationsRepo(recording.db).deletePrintingById("p-1")).toEqual({
      id: "p-1",
      releasedImageFileIds: ["if-pinned"],
    });
    expect(recording.statements[2]?.sql).toMatch(/^delete from "faces"/u);
  });

  it("deletePrintingById deletes no face when the printing is gone", async () => {
    const recording = createRecordingDb([[{ id: "f-1", fallback_image_file_id: "if-1" }], []]);

    expect(await catalogMutationsRepo(recording.db).deletePrintingById("p-1")).toBeUndefined();
    expect(recording.statements).toHaveLength(2);
  });

  it("detachDecksBeforeCatalogDeletion locks the owners, then the decks, in id order", async () => {
    const recording = createRecordingDb([
      [
        { id: "d-2", user_id: "u-1" },
        { id: "d-1", user_id: "u-1" },
      ],
      [{ id: "u-1" }],
      [{ id: "d-1" }, { id: "d-2" }],
    ]);
    await catalogMutationsRepo(recording.db).detachDecksBeforeCatalogDeletion(["p-1"]);

    expect(recording.statements[1]?.sql).toMatch(/ order by "id" for key share$/u);
    expect(recording.parameters[1]).toEqual(["u-1"]);
    expect(recording.statements[2]?.sql).toMatch(/ order by "id" for no key update$/u);
    expect(recording.parameters[2]).toEqual(["d-2", "d-1"]);
  });

  it("detachDecksBeforeCatalogDeletion takes no lock when no deck shows the printings", async () => {
    const recording = createRecordingDb([[]]);
    await catalogMutationsRepo(recording.db).detachDecksBeforeCatalogDeletion(["p-1"]);

    expect(recording.queries).toHaveLength(1);
  });

  it("syncSelfAliasOnRename is a no-op when the normalized name is unchanged", async () => {
    const throwingDb = new Proxy(
      {},
      {
        get() {
          throw new Error("db must not be touched when the normalized name is unchanged");
        },
      },
    ) as never;
    await expect(
      catalogMutationsRepo(throwingDb).syncSelfAliasOnRename("c-1", "annie", "annie"),
    ).resolves.toBeUndefined();
  });
});

describe("deleteImageFileIfUnreferenced", () => {
  it("locks the row before it checks the references, then deletes it", async () => {
    const { db, queries } = createRecordingDb([
      [{ id: "if-1" }],
      [],
      [],
      [{ id: "if-1", rehosted_url: "/media/cards/f1/if-1" }],
    ]);
    expect(await catalogMutationsRepo(db).deleteImageFileIfUnreferenced("if-1")).toEqual({
      id: "if-1",
      rehostedUrl: "/media/cards/f1/if-1",
    });
    expect(queries[0]).toContain("for update");
    expect(queries[1]).toContain('"face_images"');
    expect(queries[2]).toContain('"fallback_image_file_id"');
    expect(queries[3]).toMatch(/^delete from "image_files"/u);
  });

  it("keeps a file another face image still shows", async () => {
    const { db, queries } = createRecordingDb([[{ id: "if-1" }], [{ id: "fi-1" }]]);
    expect(await catalogMutationsRepo(db).deleteImageFileIfUnreferenced("if-1")).toBeUndefined();
    expect(queries).toHaveLength(2);
  });

  it("keeps a file a face pins as its substitute art", async () => {
    const { db, queries } = createRecordingDb([[{ id: "if-1" }], [], [{ id: "face-1" }]]);
    expect(await catalogMutationsRepo(db).deleteImageFileIfUnreferenced("if-1")).toBeUndefined();
    expect(queries).toHaveLength(3);
  });

  it("does nothing for a row that is already gone", async () => {
    const { db, queries } = createRecordingDb([[]]);
    expect(await catalogMutationsRepo(db).deleteImageFileIfUnreferenced("if-1")).toBeUndefined();
    expect(queries).toHaveLength(1);
  });
});
