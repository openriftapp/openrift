import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { imageRehostedUrl } from "@openrift/shared/image-url";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../../../db/tables.js";
import { PRINTING_1 } from "../../../test/fixtures/constants.js";
import { mockIo } from "../../../test/image-mocks.js";
import { createDbContext } from "../../../test/integration-context.js";
import { waitUntilBlockedBy } from "../../../test/row-locks.js";
import { refetchImageFile } from "../services/images/jobs.js";
import { catalogMutationsRepo } from "./catalog-mutations.js";
import { printingImagesRepo } from "./printing-images.js";

const ctx = createDbContext("a0000000-0034-4000-a000-000000000001");

describe.skipIf(!ctx)("faceImagesRepo (integration)", () => {
  const { db } = ctx!;
  const repo = printingImagesRepo(db);

  const seedPrintingId = PRINTING_1.id;
  const createdImageIds: string[] = [];
  let faceId = "";
  let seedActiveImageId: string | undefined;

  const URLS = {
    pending: "https://example.com/pending-0034.jpg",
    raceA: "https://example.com/race-main-a.jpg",
    raceB: "https://example.com/race-main-b.jpg",
    additional: "https://example.com/additional-0034.jpg",
    dedupe: "https://example.com/dedupe-0034.jpg",
    race: "https://example.com/race-0034.jpg",
    lateA: "https://example.com/late-a-0034.jpg",
    lateB: "https://example.com/late-b-0034.jpg",
    deleted: "https://example.com/deleted-0034.jpg",
    additionalEdit: "https://example.com/additional-edit-0034.jpg",
    replaced: "https://example.com/replaced-0034.jpg",
    refetched: "https://example.com/refetched-0034.jpg",
    orphan: "https://example.com/orphan-0034.jpg",
    unrehostRace: "https://example.com/unrehost-race-0034.jpg",
    untried: "https://example.com/untried-0034.jpg",
    failedOld: "https://example.com/failed-old-0034.jpg",
    failedNew: "https://example.com/failed-new-0034.jpg",
  };

  async function backendPid(trx: Kysely<Database>): Promise<number> {
    const { rows } = await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(trx);
    return rows[0]!.pid;
  }

  async function activeImageId(): Promise<string | undefined> {
    const row = await db
      .selectFrom("faceImages")
      .select("id")
      .where("faceId", "=", faceId)
      .where("isActive", "=", true)
      .executeTakeFirst();
    return row?.id;
  }

  async function pendingImageIds(): Promise<string[]> {
    const rows = await db
      .selectFrom("faceImages")
      .select("id")
      .where("faceId", "=", faceId)
      .where("isActivationPending", "=", true)
      .execute();
    return rows.map((row) => row.id);
  }

  beforeAll(async () => {
    const printing = await db
      .selectFrom("printings")
      .select("face1Id")
      .where("id", "=", seedPrintingId)
      .executeTakeFirstOrThrow();
    faceId = printing.face1Id;
    seedActiveImageId = await activeImageId();
  });

  afterAll(async () => {
    if (createdImageIds.length > 0) {
      await db.deleteFrom("faceImages").where("id", "in", createdImageIds).execute();
    }
    await db.deleteFrom("imageFiles").where("originalUrl", "in", Object.values(URLS)).execute();
    if (seedActiveImageId !== undefined) {
      await db
        .updateTable("faceImages")
        .set({ isActive: true })
        .where("id", "=", seedActiveImageId)
        .execute();
    }
  });

  it("insertImage returns null when imageUrl is null", async () => {
    expect(await repo.insertImage(seedPrintingId, null)).toBeNull();
  });

  it("keeps the current image live while a new main image waits for its rehost", async () => {
    const imageId = await repo.insertImage(seedPrintingId, URLS.pending, "main");
    createdImageIds.push(imageId!);

    expect(await activeImageId()).toBe(seedActiveImageId);
    expect(await pendingImageIds()).toEqual([imageId]);
  });

  it("leaves one pending image when two main images land at once", async () => {
    const results = await Promise.allSettled([
      repo.insertImage(seedPrintingId, URLS.raceA, "main"),
      repo.insertImage(seedPrintingId, URLS.raceB, "main"),
    ]);

    expect(results.filter((result) => result.status === "rejected")).toEqual([]);
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        createdImageIds.push(result.value);
      }
    }
    expect(await pendingImageIds()).toHaveLength(1);
    expect(await activeImageId()).toBe(seedActiveImageId);
  });

  it("activates the pending image once its rehost completes", async () => {
    const [pendingId] = await pendingImageIds();
    const imageFileId = await repo.getImageFileId(pendingId!);

    await repo.completeRehost(imageFileId!, imageRehostedUrl(imageFileId!));

    expect(await activeImageId()).toBe(pendingId);
    expect(await pendingImageIds()).toEqual([]);
  });

  it("activates a main image at once when its file is already rehosted", async () => {
    const imageFileId = await repo.getImageFileId((await activeImageId())!);
    const url = (await repo.getImageFileById(imageFileId!))!.originalUrl!;

    const imageId = await repo.insertImage(seedPrintingId, url, "main");
    createdImageIds.push(imageId!);

    expect(await activeImageId()).toBe(imageId);
  });

  it("inserts an additional image inactive and not pending", async () => {
    const imageId = await repo.insertImage(seedPrintingId, URLS.additional, "additional");
    createdImageIds.push(imageId!);

    const row = await db
      .selectFrom("faceImages")
      .select(["isActive", "isActivationPending as activateWhenRehosted"])
      .where("id", "=", imageId!)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ isActive: false, activateWhenRehosted: false });
  });

  it("refuses to activate an image whose file is not rehosted", async () => {
    const imageId = createdImageIds.at(-1)!;

    await expect(repo.setActive(imageId, true)).rejects.toThrow(/not rehosted/u);
  });

  it("leaves the row untouched when setActive repeats the stored value", async () => {
    const rowVersion = async (id: string) => {
      const { rows } = await sql<{ version: string }>`
        SELECT xmin::text AS version FROM face_images WHERE id = ${id}
      `.execute(db);
      return rows[0]!.version;
    };
    const activeId = (await activeImageId())!;
    const inactiveId = createdImageIds.at(-1)!;
    const activeBefore = await rowVersion(activeId);
    const inactiveBefore = await rowVersion(inactiveId);

    await repo.setActive(activeId, true);
    await repo.setActive(inactiveId, false);

    expect(await rowVersion(activeId)).toBe(activeBefore);
    expect(await rowVersion(inactiveId)).toBe(inactiveBefore);
  });

  it("refuses to un-rehost the file behind an active image", async () => {
    const imageFileId = await repo.getImageFileId((await activeImageId())!);

    await expect(repo.updateRehostedUrl(imageFileId!, null)).rejects.toThrow(/must stay rehosted/u);
  });

  it("refuses a rehosted URL that is not the file's own media path", async () => {
    const imageFileId = await repo.getImageFileId(createdImageIds.at(-1)!);

    await expect(
      repo.updateRehostedUrl(imageFileId!, "https://cdn.example.com/rehosted.jpg"),
    ).rejects.toThrow(/chk_image_files_rehosted_url/u);
  });

  it("counts rehost attempts until a rehost succeeds", async () => {
    const imageFileId = (await repo.getImageFileId(createdImageIds.at(-1)!))!;

    await repo.recordRehostFailure(imageFileId, "HTTP 404");
    await repo.recordRehostFailure(imageFileId, "HTTP 500");
    const failure = await db
      .selectFrom("imageRehostFailures")
      .select(["attempts", "lastError"])
      .where("imageFileId", "=", imageFileId)
      .executeTakeFirstOrThrow();
    expect(failure).toEqual({ attempts: 2, lastError: "HTTP 500" });

    await repo.completeRehost(imageFileId, imageRehostedUrl(imageFileId));
    const remaining = await db
      .selectFrom("imageRehostFailures")
      .select("imageFileId")
      .where("imageFileId", "=", imageFileId)
      .execute();
    expect(remaining).toEqual([]);
  });

  it("getImageFileById returns the image_file's urls", async () => {
    const imageFileId = (await repo.getImageFileId(createdImageIds.at(-1)!))!;
    expect(await repo.getImageFileById(imageFileId)).toEqual({
      id: imageFileId,
      originalUrl: URLS.additional,
      rehostedUrl: imageRehostedUrl(imageFileId),
      rotation: 0,
      needsTrim: false,
      quad: null,
    });
  });

  it("getImageFileById returns undefined for an unknown id", async () => {
    const row = await repo.getImageFileById("00000000-0000-4000-a000-000000000000");
    expect(row).toBeUndefined();
  });

  it("listAllRehostedWithContext returns images with card context", async () => {
    const imageFileId = await repo.getImageFileId(createdImageIds.at(-1)!);
    const rows = await repo.listAllRehostedWithContext();
    const found = rows.find((r) => r.imageId === imageFileId);
    expect(found).toMatchObject({
      cardSlug: expect.any(String),
      cardName: expect.any(String),
      printingShortCode: expect.any(String),
      setSlug: expect.any(String),
    });
  });

  it("insertImage reuses the existing image_files row for a URL it has seen", async () => {
    const first = await repo.insertImage(seedPrintingId, URLS.dedupe, "additional");
    const second = await repo.insertImage(seedPrintingId, URLS.dedupe, "additional");
    createdImageIds.push(first!, second!);

    const firstFileId = await repo.getImageFileId(first!);
    expect(firstFileId).toBeDefined();
    expect(await repo.getImageFileId(second!)).toBe(firstFileId);
  });

  it("concurrent insertImage calls for one new URL dedupe instead of throwing", async () => {
    const [first, second] = await Promise.all([
      repo.insertImage(seedPrintingId, URLS.race, "additional"),
      repo.insertImage(seedPrintingId, URLS.race, "additional"),
    ]);
    createdImageIds.push(first!, second!);

    const firstFileId = await repo.getImageFileId(first!);
    expect(firstFileId).toBeDefined();
    expect(await repo.getImageFileId(second!)).toBe(firstFileId);

    const files = await db
      .selectFrom("imageFiles")
      .select("id")
      .where("originalUrl", "=", URLS.race)
      .execute();
    expect(files).toHaveLength(1);
  });

  it("does not let a late rehost override an activation that holds the face lock", async () => {
    const pendingId = (await repo.insertImage(seedPrintingId, URLS.lateA, "main"))!;
    const otherId = (await repo.insertImage(seedPrintingId, URLS.lateB, "additional"))!;
    createdImageIds.push(pendingId, otherId);
    const otherFileId = (await repo.getImageFileId(otherId))!;
    await repo.completeRehost(otherFileId, imageRehostedUrl(otherFileId));
    const pendingFileId = (await repo.getImageFileId(pendingId))!;

    let promotion: Promise<boolean> | undefined;
    await db.transaction().execute(async (trx) => {
      const trxRepo = printingImagesRepo(trx);
      await trxRepo.deactivateActiveFace(seedPrintingId);
      promotion = repo.completeRehost(pendingFileId, imageRehostedUrl(pendingFileId));
      await waitUntilBlockedBy(db, await backendPid(trx));
      await trxRepo.setActive(otherId, true);
    });
    await promotion;

    expect(await activeImageId()).toBe(otherId);
    expect(await pendingImageIds()).toEqual([]);
  });

  it("keeps the current image when the pending one is deleted while its rehost lands", async () => {
    const before = await activeImageId();
    const pendingId = (await repo.insertImage(seedPrintingId, URLS.deleted, "main"))!;
    createdImageIds.push(pendingId);
    const pendingFileId = (await repo.getImageFileId(pendingId))!;

    let promotion: Promise<boolean> | undefined;
    await db.transaction().execute(async (trx) => {
      await printingImagesRepo(trx).deleteById(pendingId);
      promotion = repo.completeRehost(pendingFileId, imageRehostedUrl(pendingFileId));
      await waitUntilBlockedBy(db, await backendPid(trx));
    });
    await promotion;

    expect(await activeImageId()).toBe(before);
  });

  it("leaves an additional image inactive when an edit rehosts its file", async () => {
    const before = await activeImageId();
    const additionalId = (await repo.insertImage(
      seedPrintingId,
      URLS.additionalEdit,
      "additional",
    ))!;
    createdImageIds.push(additionalId);
    const fileId = (await repo.getImageFileId(additionalId))!;

    await repo.completeRehost(fileId, imageRehostedUrl(fileId));

    expect(await activeImageId()).toBe(before);
  });

  it("finds a pending image whose file another face already rehosted", async () => {
    const [activeFileId] = await db
      .selectFrom("faceImages")
      .select("imageFileId")
      .where("id", "=", (await activeImageId())!)
      .execute()
      .then((rows) => rows.map((row) => row.imageFileId));
    const pending = await db
      .insertInto("faceImages")
      .values({ faceId, imageFileId: activeFileId!, isActive: false, isActivationPending: true })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdImageIds.push(pending.id);

    expect(await repo.listDueRehosts(1000)).toContain(activeFileId);

    await repo.clearPending(pending.id);
  });

  it("moves an edited image onto a new image file and deletes the old row", async () => {
    const imageId = (await repo.insertImage(seedPrintingId, URLS.replaced, "additional"))!;
    createdImageIds.push(imageId);
    const oldId = (await repo.getImageFileId(imageId))!;
    await repo.completeRehost(oldId, imageRehostedUrl(oldId));
    const quad: ImageQuad = [
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 1, y: 4 },
    ];
    const newId = uuidv7();

    const replaced = await repo.replaceImageFile(oldId, {
      id: newId,
      rehostedUrl: imageRehostedUrl(newId),
      rotation: 90,
      needsTrim: true,
      quad,
    });

    expect(replaced).toBe(true);
    expect(await repo.getImageFileId(imageId)).toBe(newId);
    expect(await repo.getImageFileById(oldId)).toBeUndefined();
    expect(await repo.getImageFileById(newId)).toEqual({
      id: newId,
      originalUrl: URLS.replaced,
      rehostedUrl: imageRehostedUrl(newId),
      rotation: 90,
      needsTrim: true,
      quad,
    });
    const lateId = uuidv7();
    const late = await repo.replaceImageFile(oldId, {
      id: lateId,
      rehostedUrl: imageRehostedUrl(lateId),
      rotation: 0,
      needsTrim: false,
      quad: null,
    });
    expect(late).toBe(false);
  });

  it("moves a refetched image onto a new image file under a new URL", async () => {
    const imageId = (await repo.insertImage(seedPrintingId, URLS.refetched, "additional"))!;
    createdImageIds.push(imageId);
    const oldId = (await repo.getImageFileId(imageId))!;
    await repo.completeRehost(oldId, imageRehostedUrl(oldId));

    const outcome = await refetchImageFile(mockIo, repo, oldId);

    expect(outcome.status).toBe("rehosted");
    expect(outcome.imageFileId).not.toBe(oldId);
    expect(await repo.getImageFileId(imageId)).toBe(outcome.imageFileId);
    expect(await repo.getImageFileById(oldId)).toBeUndefined();
    expect(await repo.getImageFileById(outcome.imageFileId)).toMatchObject({
      originalUrl: URLS.refetched,
      rehostedUrl: imageRehostedUrl(outcome.imageFileId),
    });
  });

  it("keeps an unreferenced image file that an attach reuses while the cleanup waits", async () => {
    const imageFileId = await repo.imageFileForUrl(URLS.orphan);
    let cleanup: Promise<{ id: string; rehostedUrl: string | null } | undefined> | undefined;

    await db.transaction().execute(async (trx) => {
      const attached = await trx
        .insertInto("faceImages")
        .values({ faceId, imageFileId })
        .returning("id")
        .executeTakeFirstOrThrow();
      createdImageIds.push(attached.id);
      cleanup = catalogMutationsRepo(db).deleteImageFileIfUnreferenced(imageFileId);
      await waitUntilBlockedBy(db, await backendPid(trx));
    });

    expect(await cleanup).toBeUndefined();
    expect(await repo.getImageFileById(imageFileId)).toBeDefined();
  });

  it("deletes an image file nothing uses", async () => {
    const imageId = createdImageIds.at(-1)!;
    const imageFileId = (await repo.getImageFileId(imageId))!;
    await db.deleteFrom("faceImages").where("id", "=", imageId).execute();

    expect(await catalogMutationsRepo(db).deleteImageFileIfUnreferenced(imageFileId)).toEqual({
      id: imageFileId,
      rehostedUrl: null,
    });
    expect(await repo.getImageFileById(imageFileId)).toBeUndefined();
  });

  it("keeps the URL of a file an activation made live while the clear waited", async () => {
    const imageId = (await repo.insertImage(seedPrintingId, URLS.unrehostRace, "additional"))!;
    createdImageIds.push(imageId);
    const imageFileId = (await repo.getImageFileId(imageId))!;
    await repo.completeRehost(imageFileId, imageRehostedUrl(imageFileId));

    let cleared: Promise<boolean> | undefined;
    await db.transaction().execute(async (trx) => {
      const trxRepo = printingImagesRepo(trx);
      await trxRepo.deactivateActiveFace(seedPrintingId);
      await trxRepo.setActive(imageId, true);
      cleared = repo.clearRehostedUrl(imageFileId);
      await waitUntilBlockedBy(db, await backendPid(trx));
    });

    expect(await cleared).toBe(false);
    const file = await repo.getImageFileById(imageFileId);
    expect(file?.rehostedUrl).toBe(imageRehostedUrl(imageFileId));
  });

  it("lists failed files without backoff, after untried ones and least recently tried first", async () => {
    async function unrehostedFile(url: string): Promise<string> {
      const imageId = (await repo.insertImage(seedPrintingId, url, "additional"))!;
      createdImageIds.push(imageId);
      return (await repo.getImageFileId(imageId))!;
    }
    async function failedAgo(url: string, hours: number): Promise<string> {
      const fileId = await unrehostedFile(url);
      await repo.recordRehostFailure(fileId, "HTTP 500");
      await db
        .updateTable("imageRehostFailures")
        .set({ lastAttemptAt: new Date(Date.now() - hours * 60 * 60 * 1000) })
        .where("imageFileId", "=", fileId)
        .execute();
      return fileId;
    }
    const recent = await failedAgo(URLS.failedNew, 1);
    const oldest = await failedAgo(URLS.failedOld, 5);
    const untried = await unrehostedFile(URLS.untried);

    const unrehosted = await repo.listUnrehosted(100_000);
    const listed = unrehosted.map((row) => row.imageId);

    expect(listed.indexOf(untried)).toBeGreaterThanOrEqual(0);
    expect(listed.indexOf(untried)).toBeLessThan(listed.indexOf(oldest));
    expect(listed.indexOf(oldest)).toBeLessThan(listed.indexOf(recent));
  });
});
