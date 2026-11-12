import { imageRehostedUrl } from "@openrift/shared/image-url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PRINTING_1 } from "../../../test/fixtures/constants.js";
import { createDbContext } from "../../../test/integration-context.js";
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
  };

  async function settle(): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
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
      .where("activateWhenRehosted", "=", true)
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
      .select(["isActive", "activateWhenRehosted"])
      .where("id", "=", imageId!)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ isActive: false, activateWhenRehosted: false });
  });

  it("refuses to activate an image whose file is not rehosted", async () => {
    const imageId = createdImageIds.at(-1)!;

    await expect(repo.setActive(imageId, true)).rejects.toThrow(/not rehosted/u);
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
      await settle();
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
      await settle();
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
      .values({ faceId, imageFileId: activeFileId!, isActive: false, activateWhenRehosted: true })
      .returning("id")
      .executeTakeFirstOrThrow();
    createdImageIds.push(pending.id);

    expect(await repo.listDueRehosts(1000)).toContain(activeFileId);

    await repo.clearPending(pending.id);
  });
});
