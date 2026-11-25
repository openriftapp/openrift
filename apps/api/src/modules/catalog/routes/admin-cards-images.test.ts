import { ERROR_CODES } from "@openrift/shared/error-codes";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { editImageFile } from "../services/images/edit.js";
import {
  ensureRehostedOriginal,
  rehostFaceImage,
  rehostImageFile,
  refetchImageFile,
  unrehostImageFile,
} from "../services/images/jobs.js";
import { ensureOriginalOnDisk, processAndSave } from "../services/images/variants.js";
import { cleanupOrphanedImageFiles } from "../services/printing-admin.js";
import { adminCardImagesRouter } from "./admin-cards-images";

vi.mock("../services/images/paths.js", () => ({
  CARD_MEDIA_DIR: "/mock/media/cards",
}));

vi.mock("../services/images/jobs.js", () => ({
  ensureRehostedOriginal: vi.fn(),
  rehostFaceImage: vi.fn(),
  rehostImageFile: vi.fn(),
  refetchImageFile: vi.fn(),
  unrehostImageFile: vi.fn(),
}));

vi.mock("../services/printing-admin.js", () => ({
  cleanupOrphanedImageFiles: vi.fn(),
}));

vi.mock("../services/images/variants.js", () => ({
  ensureOriginalOnDisk: vi.fn(),
  processAndSave: vi.fn(),
}));

vi.mock("../services/images/edit.js", () => ({
  editImageFile: vi.fn(),
}));

vi.mock("../services/images/download.js", () => ({
  MAX_IMAGE_BYTES: 50 * 1024 * 1024,
  downloadImage: vi.fn(),
}));

vi.mock("uuid", () => ({
  v7: vi.fn(() => "mock-uuid-v7"),
}));

const mockRehostFaceImage = vi.mocked(rehostFaceImage);
const mockRehostImageFile = vi.mocked(rehostImageFile);
const mockRefetchImageFile = vi.mocked(refetchImageFile);
const mockEnsureRehostedOriginal = vi.mocked(ensureRehostedOriginal);
const mockUnrehostImageFile = vi.mocked(unrehostImageFile);
const mockCleanupOrphanedImageFiles = vi.mocked(cleanupOrphanedImageFiles);
const mockProcessAndSave = vi.mocked(processAndSave);
const mockEditImageFile = vi.mocked(editImageFile);
const mockEnsureOriginalOnDisk = vi.mocked(ensureOriginalOnDisk);

const mockPrintingImages = {
  faceIdOfImage: vi.fn(),
  candidateFace: vi.fn(),
  faceImageState: vi.fn(),
  getCandidatePrintingById: vi.fn(),
  getIdAndRehostedUrl: vi.fn(),
  getImageFileId: vi.fn(),
  getFallbackArt: vi.fn(),
  setFallbackArt: vi.fn(),
  imageFileForUrl: vi.fn(),
  insertUnattachedImageFile: vi.fn(),
  getImageFileById: vi.fn(),
  deleteById: vi.fn(),
  getForActivate: vi.fn(),
  updateRehostedUrl: vi.fn(),
  getForRehost: vi.fn(),
};

const mockCatalog = { getPrintingById: vi.fn() };
const mockCatalogMutations = {};

const mockTrxPrintingImages = {
  insertImage: vi.fn(),
  deactivateActiveFace: vi.fn(),
  setActive: vi.fn(),
  markPending: vi.fn(),
  clearPending: vi.fn(),
  clearReviewed: vi.fn(),
  insertUploadedImage: vi.fn(),
  insertUnattachedImageFile: vi.fn(),
  setFallbackArt: vi.fn(),
};

const mockTransact = vi.fn(
  async (callback: (repos: { printingImages: typeof mockTrxPrintingImages }) => Promise<unknown>) =>
    callback({ printingImages: mockTrxPrintingImages }),
);

// AppErrors thrown by handlers are bridged to ORPCErrors, so the error body is `{ message, code }`.
const USER_ID = "a0000000-0001-4000-a000-000000000001";
const mockIo = { fetch: vi.fn() };

const mockAdminEvents = {
  insert: vi.fn(),
  imageIdsUploadedBy: vi.fn(),
  wasPrintingCreatedBy: vi.fn(),
};
const mockPrintingDesk = {
  isDeskPrinting: vi.fn(),
  getFaceLinks: vi.fn(),
  printingIdsShowingFace: vi.fn(),
};

const FULL_ADMIN = { isAdmin: true, sections: [] };
const GRANT_HOLDER = { isAdmin: false, sections: ["printing-desk"] };
let adminAccess: typeof FULL_ADMIN | typeof GRANT_HOLDER = FULL_ADMIN;

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("adminAccess", adminAccess as never);
  c.set("io", mockIo as never);
  c.set("transact", mockTransact as never);
  c.set("repos", {
    catalog: mockCatalog,
    catalogMutations: mockCatalogMutations,
    printingImages: mockPrintingImages,
    adminEvents: mockAdminEvents,
    printingDesk: mockPrintingDesk,
  } as never);
  await next();
});
registerRouterForTest(app, adminCardImagesRouter);

const SET_IMAGE =
  "/api/admin/v1/cards/candidate-printings/00000000-0000-4000-a000-000000000001/set-image";
const IMAGE_ID = "00000000-0000-4000-a000-000000000002";
const PRINTING_ID = "00000000-0000-4000-a000-000000000003";

describe("POST /candidate-printings/:id/set-image", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingImages.candidateFace.mockResolvedValue("back");
    mockPrintingImages.faceImageState.mockResolvedValue({
      activeImageId: "old-main",
      hasPending: false,
    });
  });

  it("rehosts the new main image and names the image it replaced", async () => {
    mockPrintingImages.getCandidatePrintingById.mockResolvedValue({
      printingId: "printing-1",
      imageUrl: "https://example.com/img.png",
      candidateCardId: "cc-1",
    });
    mockTrxPrintingImages.insertImage.mockResolvedValue("image-id-1");
    mockRehostFaceImage.mockResolvedValue({ status: "rehosted" });
    mockPrintingImages.faceImageState
      .mockResolvedValueOnce({ activeImageId: "old-main", hasPending: false })
      .mockResolvedValueOnce({ activeImageId: "image-id-1", hasPending: false });

    const res = await app.request(SET_IMAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "main" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      imageId: "image-id-1",
      replacedImageId: "old-main",
      restorable: true,
    });
    expect(mockTrxPrintingImages.insertImage).toHaveBeenCalledWith(
      "printing-1",
      "https://example.com/img.png",
      "main",
      "back",
    );
    expect(mockRehostFaceImage).toHaveBeenCalledWith(mockIo, mockPrintingImages, "image-id-1");
  });

  it("inserts in additional mode", async () => {
    mockPrintingImages.getCandidatePrintingById.mockResolvedValue({
      printingId: "printing-1",
      imageUrl: "https://example.com/img.png",
      candidateCardId: "cc-1",
    });
    mockTrxPrintingImages.insertImage.mockResolvedValue("image-id-1");
    mockRehostFaceImage.mockResolvedValue({ status: "rehosted" });

    const res = await app.request(SET_IMAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "additional" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      imageId: "image-id-1",
      replacedImageId: null,
      restorable: true,
    });
    expect(mockTrxPrintingImages.insertImage).toHaveBeenCalledWith(
      "printing-1",
      "https://example.com/img.png",
      "additional",
      "back",
    );
    expect(mockRehostFaceImage).not.toHaveBeenCalled();
  });

  it("skips rehost when insertImage returns null", async () => {
    mockPrintingImages.getCandidatePrintingById.mockResolvedValue({
      printingId: "printing-1",
      imageUrl: "https://example.com/img.png",
      candidateCardId: "cc-1",
    });
    mockTrxPrintingImages.insertImage.mockResolvedValue(null);

    const res = await app.request(SET_IMAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "main" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ imageId: null, replacedImageId: null, restorable: false });
    expect(mockRehostFaceImage).not.toHaveBeenCalled();
  });

  it("is not restorable when the new main image still waits to go live", async () => {
    mockPrintingImages.getCandidatePrintingById.mockResolvedValue({
      printingId: "printing-1",
      imageUrl: "https://example.com/img.png",
      candidateCardId: "cc-1",
    });
    mockTrxPrintingImages.insertImage.mockResolvedValue("image-id-1");
    mockRehostFaceImage.mockResolvedValue({ status: "failed" });

    const res = await app.request(SET_IMAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "main" }),
    });
    expect(await res.json()).toEqual({
      imageId: "image-id-1",
      replacedImageId: null,
      restorable: false,
    });
  });

  it("is not restorable when another image was waiting to go live on the face", async () => {
    mockPrintingImages.getCandidatePrintingById.mockResolvedValue({
      printingId: "printing-1",
      imageUrl: "https://example.com/img.png",
      candidateCardId: "cc-1",
    });
    mockTrxPrintingImages.insertImage.mockResolvedValue("image-id-1");
    mockPrintingImages.faceImageState.mockResolvedValue({
      activeImageId: null,
      hasPending: true,
    });

    const res = await app.request(SET_IMAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "additional" }),
    });
    const body = (await res.json()) as { restorable: boolean };
    expect(body.restorable).toBe(false);
  });
});

describe("DELETE /printing-images/:imageId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("hands the image file to the shared orphan cleanup after deleting the image", async () => {
    mockPrintingImages.getIdAndRehostedUrl.mockResolvedValue({
      rehostedUrl: "/cards/origin/img-1.avif",
    });
    mockPrintingImages.getImageFileId.mockResolvedValue("ci-1");
    mockPrintingImages.deleteById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockPrintingImages.deleteById).toHaveBeenCalledWith(IMAGE_ID);
    expect(mockCleanupOrphanedImageFiles).toHaveBeenCalledWith(mockIo, mockTransact, ["ci-1"]);
    expect(mockPrintingImages.deleteById.mock.invocationCallOrder[0]).toBeLessThan(
      mockCleanupOrphanedImageFiles.mock.invocationCallOrder[0]!,
    );
  });

  it("cleans up nothing when the image has no file", async () => {
    mockPrintingImages.getIdAndRehostedUrl.mockResolvedValue({ rehostedUrl: null });
    mockPrintingImages.getImageFileId.mockResolvedValue(undefined);
    mockPrintingImages.deleteById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(mockCleanupOrphanedImageFiles).not.toHaveBeenCalled();
  });
});

describe("POST /printing-images/:imageId/activate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
  });

  it("returns 204 and deactivates current active when activating", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: "printing-1",
      face: "front",
      imageFileId: "file-1",
      rehostedUrl: "/media/cards/-1/file-1",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.deactivateActiveFace).toHaveBeenCalledWith("printing-1", "front");
    expect(mockTrxPrintingImages.setActive).toHaveBeenCalledWith(IMAGE_ID, true);
  });

  it("activating a back image leaves the active front alone", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: "printing-1",
      face: "back",
      imageFileId: "file-1",
      rehostedUrl: "/media/cards/-1/file-1",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.deactivateActiveFace).toHaveBeenCalledWith("printing-1", "back");
  });

  it("returns 204 without deactivating when setting inactive", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: "printing-1",
      face: "front",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.deactivateActiveFace).not.toHaveBeenCalled();
    expect(mockTrxPrintingImages.clearPending).toHaveBeenCalledWith(IMAGE_ID);
    expect(mockTrxPrintingImages.setActive).toHaveBeenCalledWith(IMAGE_ID, false);
  });

  it("rehosts a not-yet-rehosted image before it becomes active", async () => {
    mockRehostImageFile.mockResolvedValue({ status: "rehosted" });
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: "printing-1",
      face: "front",
      imageFileId: "file-1",
      rehostedUrl: null,
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });

    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.markPending).toHaveBeenCalledWith(IMAGE_ID);
    expect(mockRehostImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, "file-1");
    expect(mockTrxPrintingImages.setActive).not.toHaveBeenCalled();
    expect(mockTrxPrintingImages.deactivateActiveFace).not.toHaveBeenCalled();
  });

  it("keeps the current image, and says the new one stays queued, when that rehost fails", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: "printing-1",
      face: "front",
      imageFileId: "file-1",
      rehostedUrl: null,
    });
    mockRehostImageFile.mockResolvedValue({ status: "failed", error: "HTTP 404" });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.message).toBe(
      "Could not rehost the image: HTTP 404. It stays queued and goes live once a retry succeeds.",
    );
    expect(mockTrxPrintingImages.setActive).not.toHaveBeenCalled();
    expect(mockTrxPrintingImages.deactivateActiveFace).not.toHaveBeenCalled();
  });
});

describe("POST /printing-images/:imageId/unkeep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
  });

  it("clears the review mark and records the event", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: "printing-1",
      face: "front",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/unkeep`, {
      method: "POST",
    });
    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.clearReviewed).toHaveBeenCalledWith(IMAGE_ID);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "image.unkeep", entityId: IMAGE_ID }),
    );
  });

  it("returns 404 when the image is gone", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/unkeep`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
    expect(mockTrxPrintingImages.clearReviewed).not.toHaveBeenCalled();
  });
});

describe("POST /printing-images/:imageId/unrehost", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("un-rehosts the whole image file, shared or not", async () => {
    mockPrintingImages.getImageFileId.mockResolvedValue("ci-1");
    mockUnrehostImageFile.mockResolvedValue("/cards/origin/img-1.avif");

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/unrehost`, {
      method: "POST",
    });
    expect(res.status).toBe(204);
    expect(mockUnrehostImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, "ci-1");
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "image.unrehost",
        oldValues: { rehostedUrl: "/cards/origin/img-1.avif", imageFileId: "ci-1" },
      }),
    );
  });

  it("returns 404 when image not found", async () => {
    mockPrintingImages.getImageFileId.mockResolvedValue(undefined);

    const res = await app.request(
      "/api/admin/v1/cards/printing-images/00000000-0000-4000-a000-000000000099/unrehost",
      {
        method: "POST",
      },
    );
    expect(res.status).toBe(404);
    expect(mockUnrehostImageFile).not.toHaveBeenCalled();
  });

  it("passes a refusal from the file-level un-rehost through", async () => {
    mockPrintingImages.getImageFileId.mockResolvedValue("ci-1");
    mockUnrehostImageFile.mockRejectedValue(
      new AppError(400, ERROR_CODES.BAD_REQUEST, "Image is not rehosted"),
    );

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/unrehost`, {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("not rehosted");
  });
});

describe("POST /printing-images/:imageId/rehost", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("answers with the URL of the image file the refetch wrote", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue({
      originalUrl: "https://example.com/img.png",
      imageFileId: "00594247-a18a-4efd-8998-105449a4c1ab",
      rehostedUrl: "/media/cards/ab/00594247-a18a-4efd-8998-105449a4c1ab",
      rotation: 0,
      needsTrim: false,
      needsLevels: false,
      quad: null,
    });
    mockRefetchImageFile.mockResolvedValue({
      status: "rehosted",
      imageFileId: "0199aaaa-0000-7000-8000-0000000000cd",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/rehost`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      rehostedUrl: "/media/cards/cd/0199aaaa-0000-7000-8000-0000000000cd",
    });
    expect(mockRefetchImageFile).toHaveBeenCalledWith(
      mockIo,
      mockPrintingImages,
      "00594247-a18a-4efd-8998-105449a4c1ab",
    );
  });

  it("answers 400 with the reason when the refetch fails", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue({
      originalUrl: "https://example.com/img.png",
      imageFileId: "ci-1",
    });
    mockRefetchImageFile.mockResolvedValue({
      status: "failed",
      error: "HTTP 404",
      imageFileId: "ci-1",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/rehost`, {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("HTTP 404");
  });
});

describe("POST /printing-images/:imageId/rotate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("edits the image file with the new rotation and keeps the other settings", async () => {
    const image = {
      imageFileId: "ci-1",
      rotation: 0,
      needsTrim: true,
      needsLevels: true,
      quad: null,
      originalUrl: "https://example.com/img.png",
    };
    mockPrintingImages.getForRehost.mockResolvedValue(image);
    mockEditImageFile.mockResolvedValue("ci-2");

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation: 90 }),
    });
    expect(res.status).toBe(204);
    expect(mockEditImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, image, {
      rotation: 90,
      needsTrim: true,
      needsLevels: true,
      quad: null,
    });
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: { rotation: 0, imageFileId: "ci-1" },
        newValues: { rotation: 90, imageFileId: "ci-2" },
      }),
    );
  });

  it("records nothing when the edit fails", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue({
      imageFileId: "ci-1",
      rotation: 0,
      needsTrim: false,
      needsLevels: false,
      quad: null,
      originalUrl: "https://example.com/img.png",
      rehostedUrl: null,
    });
    mockEditImageFile.mockRejectedValue(
      new AppError(400, ERROR_CODES.BAD_REQUEST, "Could not rehost the image: HTTP 404"),
    );

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation: 90 }),
    });

    expect(res.status).toBe(400);
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("returns 404 when image not found", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue(null);

    const res = await app.request(
      "/api/admin/v1/cards/printing-images/00000000-0000-4000-a000-000000000099/rotate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotation: 180 }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("rejects an invalid rotation value", async () => {
    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation: 45 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /printing-images/:imageId/set-needs-trim", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("edits the image file with the new needs-trim value", async () => {
    const image = {
      imageFileId: "ci-1",
      rotation: 90,
      needsTrim: false,
      needsLevels: false,
      quad: null,
      originalUrl: "https://example.com/img.png",
    };
    mockPrintingImages.getForRehost.mockResolvedValue(image);
    mockEditImageFile.mockResolvedValue("ci-2");

    const res = await app.request(
      `/api/admin/v1/cards/printing-images/${IMAGE_ID}/set-needs-trim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsTrim: true }),
      },
    );
    expect(res.status).toBe(204);
    expect(mockEditImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, image, {
      rotation: 90,
      needsTrim: true,
      needsLevels: false,
      quad: null,
    });
  });

  it("returns 404 when image not found", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue(null);

    const res = await app.request(
      "/api/admin/v1/cards/printing-images/00000000-0000-4000-a000-000000000099/set-needs-trim",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsTrim: true }),
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /printing-images/:imageId/set-needs-levels", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("edits the image file with the new needs-levels value and keeps trim", async () => {
    const image = {
      imageFileId: "ci-1",
      rotation: 90,
      needsTrim: true,
      needsLevels: false,
      quad: null,
      originalUrl: "https://example.com/img.png",
    };
    mockPrintingImages.getForRehost.mockResolvedValue(image);
    mockEditImageFile.mockResolvedValue("ci-2");

    const res = await app.request(
      `/api/admin/v1/cards/printing-images/${IMAGE_ID}/set-needs-levels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsLevels: true }),
      },
    );
    expect(res.status).toBe(204);
    expect(mockEditImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, image, {
      rotation: 90,
      needsTrim: true,
      needsLevels: true,
      quad: null,
    });
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "image.set-needs-levels",
        oldValues: { needsLevels: false, imageFileId: "ci-1" },
        newValues: { needsLevels: true, imageFileId: "ci-2" },
      }),
    );
  });

  it("returns 404 when image not found", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue(null);

    const res = await app.request(
      "/api/admin/v1/cards/printing-images/00000000-0000-4000-a000-000000000099/set-needs-levels",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsLevels: true }),
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /printing-images/:imageId/quad", () => {
  const QUAD = [
    { x: 10, y: 5 },
    { x: 90, y: 5 },
    { x: 90, y: 95 },
    { x: 10, y: 95 },
  ];
  const IMAGE = {
    imageFileId: "ci-1",
    rotation: 90,
    needsTrim: true,
    needsLevels: false,
    quad: null,
    originalUrl: "https://example.com/img.png",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockPrintingImages.getForRehost.mockResolvedValue(IMAGE);
    mockEditImageFile.mockResolvedValue("ci-2");
  });

  it("edits the image file with the new quad", async () => {
    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/quad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quad: QUAD }),
    });

    expect(res.status).toBe(204);
    expect(mockEditImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, IMAGE, {
      rotation: 90,
      needsTrim: true,
      needsLevels: false,
      quad: QUAD,
    });
  });

  it("clears the quad when null is sent", async () => {
    const straightened = { ...IMAGE, quad: QUAD };
    mockPrintingImages.getForRehost.mockResolvedValue(straightened);

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/quad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quad: null }),
    });

    expect(res.status).toBe(204);
    expect(mockEditImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, straightened, {
      rotation: 90,
      needsTrim: true,
      needsLevels: false,
      quad: null,
    });
  });

  it("answers the pipeline's rejection and records nothing", async () => {
    mockEditImageFile.mockRejectedValue(
      new AppError(400, ERROR_CODES.BAD_REQUEST, "Quad does not fit the original image"),
    );

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/quad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quad: QUAD }),
    });

    expect(res.status).toBe(400);
    expect(mockAdminEvents.insert).not.toHaveBeenCalled();
  });

  it("returns 404 when image not found", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue(null);

    const res = await app.request(
      "/api/admin/v1/cards/printing-images/00000000-0000-4000-a000-000000000099/quad",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quad: QUAD }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("rejects a quad that is not four corners", async () => {
    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/quad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quad: QUAD.slice(0, 3) }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /printing-images/:imageId/original", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
  });

  it("returns the orig file's url and stored pixel grid", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue({
      imageFileId: "00594247-a18a-4efd-8998-105449a4c1ab",
      rotation: 90,
      needsTrim: false,
      needsLevels: false,
      quad: null,
      originalUrl: "https://example.com/img.png",
    });
    mockEnsureOriginalOnDisk.mockResolvedValue({
      url: "/media/cards/ab/00594247-a18a-4efd-8998-105449a4c1ab-orig.jpg",
      width: 1200,
      height: 1600,
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/original`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      url: "/media/cards/ab/00594247-a18a-4efd-8998-105449a4c1ab-orig.jpg",
      width: 1200,
      height: 1600,
    });
    expect(mockEnsureRehostedOriginal).toHaveBeenCalledWith(
      mockIo,
      mockPrintingImages,
      expect.objectContaining({ imageFileId: "00594247-a18a-4efd-8998-105449a4c1ab" }),
    );
    expect(mockEnsureOriginalOnDisk).toHaveBeenCalledWith(
      mockIo,
      "00594247-a18a-4efd-8998-105449a4c1ab",
    );
  });

  it("returns 400 when there is no original to straighten", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue({
      imageFileId: "00594247-a18a-4efd-8998-105449a4c1ab",
      rotation: 0,
      needsTrim: false,
      needsLevels: false,
      quad: null,
      originalUrl: null,
    });
    mockEnsureOriginalOnDisk.mockRejectedValue(
      new AppError(400, ERROR_CODES.BAD_REQUEST, "Image has no original to straighten"),
    );

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/original`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.message).toContain("no original to straighten");
  });

  it("returns 404 when image not found", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue(null);

    const res = await app.request(
      "/api/admin/v1/cards/printing-images/00000000-0000-4000-a000-000000000099/original",
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /printing/:printingId/add-image-url", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingDesk.getFaceLinks.mockResolvedValue({ face1Id: "face-1", face2Id: null });
  });

  it("inserts with default mode", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/add-image-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://i.imgur.com/img.png" }),
    });
    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.insertImage).toHaveBeenCalledWith(
      "printing-1",
      "https://i.imgur.com/img.png",
      "main",
      undefined,
    );
  });

  it("rehosts the new image right away", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });
    mockTrxPrintingImages.insertImage.mockResolvedValue("image-id-1");

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/add-image-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/img.png" }),
    });

    expect(res.status).toBe(204);
    expect(mockRehostFaceImage).toHaveBeenCalledWith(mockIo, mockPrintingImages, "image-id-1");
  });

  it("respects explicit mode", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/add-image-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://images.tcgplayer.com/img.png", mode: "additional" }),
    });
    expect(res.status).toBe(204);
    expect(mockRehostFaceImage).not.toHaveBeenCalled();
    expect(mockTrxPrintingImages.insertImage).toHaveBeenCalledWith(
      "printing-1",
      "https://images.tcgplayer.com/img.png",
      "additional",
      undefined,
    );
  });

  it("returns 400 when url is empty", async () => {
    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/add-image-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "  " }),
    });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("url is required");
  });
});

describe("POST /printing/:printingId/upload-image", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingDesk.getFaceLinks.mockResolvedValue({ face1Id: "face-1", face2Id: "face-2" });
  });

  it("400s a second-side upload to a single-sided printing", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });
    mockPrintingDesk.getFaceLinks.mockResolvedValue({ face1Id: "face-1", face2Id: null });
    const formData = new FormData();
    formData.append("file", new File(["image-data"], "card.png", { type: "image/png" }));
    formData.append("face", "back");

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/upload-image`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
    expect(mockProcessAndSave).not.toHaveBeenCalled();
  });

  it("returns 200 with rehosted url on success", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });
    mockProcessAndSave.mockResolvedValue(undefined);
    mockTrxPrintingImages.insertUploadedImage.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("file", new File(["image-data"], "card.png", { type: "image/png" }));

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/upload-image`, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ rehostedUrl: "/media/cards/v7/mock-uuid-v7" });
    expect(mockTrxPrintingImages.insertUploadedImage).toHaveBeenCalledWith({
      id: "mock-uuid-v7",
      printingId: "printing-1",
      rehostedUrl: "/media/cards/v7/mock-uuid-v7",
      mode: "main",
      face: "front",
      credit: undefined,
    });
  });

  it("stores a back face with the image credit", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });
    mockProcessAndSave.mockResolvedValue(undefined);
    mockTrxPrintingImages.insertUploadedImage.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("file", new File(["image-data"], "card.png", { type: "image/png" }));
    formData.append("face", "back");
    formData.append("credit", "gamesnight");

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/upload-image`, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    expect(mockTrxPrintingImages.insertUploadedImage).toHaveBeenCalledWith(
      expect.objectContaining({ face: "back", credit: "gamesnight" }),
    );
  });

  it("respects explicit mode", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: "printing-1" });
    mockProcessAndSave.mockResolvedValue(undefined);
    mockTrxPrintingImages.insertUploadedImage.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("file", new File(["image-data"], "card.jpg", { type: "image/jpeg" }));
    formData.append("mode", "additional");

    const res = await app.request(`/api/admin/v1/cards/printing/${PRINTING_ID}/upload-image`, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    expect(mockTrxPrintingImages.insertUploadedImage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "additional" }),
    );
  });
});

describe("audit events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
  });

  it("set-image records the candidate source and mode", async () => {
    mockPrintingImages.getCandidatePrintingById.mockResolvedValue({
      printingId: "printing-1",
      imageUrl: "https://example.com/img.png",
      candidateCardId: "cc-1",
      shortCode: "OGN-001",
    });
    mockTrxPrintingImages.insertImage.mockResolvedValue("image-id-1");
    mockRehostFaceImage.mockResolvedValue({ status: "rehosted" });
    mockPrintingImages.faceImageState.mockResolvedValue({ activeImageId: null, hasPending: false });

    const res = await app.request(SET_IMAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "main" }),
    });
    expect(res.status).toBe(200);
    expect(mockAdminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "image.set-from-candidate",
        entityType: "image",
        entityId: "image-id-1",
        newValues: expect.objectContaining({
          printingId: "printing-1",
          imageUrl: "https://example.com/img.png",
          mode: "main",
        }),
      }),
    );
  });
});

const FALLBACK_ART = `/api/admin/v1/cards/printing/${PRINTING_ID}/fallback-art`;
const IMAGE_FILE_ID = "00000000-0000-4000-a000-000000000004";

function mockPrintingWithAutoFallback(): void {
  mockPrintingImages.getFallbackArt.mockResolvedValue({
    id: "printing-1",
    shortCode: "OGN-001",
    fallbackArtMode: "auto",
    fallbackImageFileId: null,
  });
}

describe("POST /printing/:printingId/fallback-art", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingWithAutoFallback();
  });

  it("pins an image file", async () => {
    mockPrintingImages.getImageFileById.mockResolvedValue({ id: IMAGE_FILE_ID });

    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pinned", imageFileId: IMAGE_FILE_ID }),
    });

    expect(res.status).toBe(204);
    expect(mockPrintingImages.setFallbackArt).toHaveBeenCalledWith(
      PRINTING_ID,
      "pinned",
      IMAGE_FILE_ID,
      undefined,
    );
  });

  it("sets the fallback art of the side the review card shows", async () => {
    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "none", face: "back" }),
    });

    expect(res.status).toBe(204);
    expect(mockPrintingImages.getFallbackArt).toHaveBeenCalledWith(PRINTING_ID, "back");
    expect(mockPrintingImages.setFallbackArt).toHaveBeenCalledWith(
      PRINTING_ID,
      "none",
      null,
      "back",
    );
  });

  it.each([
    { name: "clears the pin when switching back to auto", mode: "auto" },
    { name: "suppresses the substitute in none mode", mode: "none" },
  ])("$name", async ({ mode }) => {
    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });

    expect(res.status).toBe(204);
    expect(mockPrintingImages.setFallbackArt).toHaveBeenCalledWith(
      PRINTING_ID,
      mode,
      null,
      undefined,
    );
  });

  it("returns 400 when pinning without an image file", async () => {
    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pinned" }),
    });

    expect(res.status).toBe(400);
    expect(mockPrintingImages.setFallbackArt).not.toHaveBeenCalled();
  });

  it("returns 400 when a non-pinned mode carries an image file", async () => {
    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto", imageFileId: IMAGE_FILE_ID }),
    });

    expect(res.status).toBe(400);
    expect(mockPrintingImages.setFallbackArt).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown image file", async () => {
    mockPrintingImages.getImageFileById.mockResolvedValue(undefined);

    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pinned", imageFileId: IMAGE_FILE_ID }),
    });

    expect(res.status).toBe(404);
    expect(mockPrintingImages.setFallbackArt).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown printing", async () => {
    mockPrintingImages.getFallbackArt.mockResolvedValue(undefined);

    const res = await app.request(FALLBACK_ART, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /printing/:printingId/fallback-art/from-url", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingWithAutoFallback();
  });

  it("ingests the URL, pins it, and rehosts the file", async () => {
    mockPrintingImages.imageFileForUrl.mockResolvedValue(IMAGE_FILE_ID);
    mockRehostImageFile.mockResolvedValue({ status: "rehosted" });

    const res = await app.request(`${FALLBACK_ART}/from-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "  https://example.com/art.png  " }),
    });

    expect(res.status).toBe(204);
    expect(mockPrintingImages.imageFileForUrl).toHaveBeenCalledWith("https://example.com/art.png");
    expect(mockPrintingImages.setFallbackArt).toHaveBeenCalledWith(
      PRINTING_ID,
      "pinned",
      IMAGE_FILE_ID,
      undefined,
    );
    expect(mockRehostImageFile).toHaveBeenCalledWith(mockIo, mockPrintingImages, IMAGE_FILE_ID);
  });

  it("returns 400 when the url is blank", async () => {
    const res = await app.request(`${FALLBACK_ART}/from-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "   " }),
    });

    expect(res.status).toBe(400);
    expect(mockPrintingImages.setFallbackArt).not.toHaveBeenCalled();
  });
});

describe("POST /printing/:printingId/fallback-art/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = FULL_ADMIN;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingWithAutoFallback();
  });

  it("stores the file without attaching it as a printing image", async () => {
    mockProcessAndSave.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("file", new File(["art-data"], "art.png", { type: "image/png" }));

    const res = await app.request(`${FALLBACK_ART}/upload`, { method: "POST", body: formData });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ rehostedUrl: "/media/cards/v7/mock-uuid-v7" });
    expect(mockTrxPrintingImages.insertUnattachedImageFile).toHaveBeenCalledWith({
      id: "mock-uuid-v7",
      rehostedUrl: "/media/cards/v7/mock-uuid-v7",
    });
    expect(mockTrxPrintingImages.insertUploadedImage).not.toHaveBeenCalled();
    expect(mockTrxPrintingImages.setFallbackArt).toHaveBeenCalledWith(
      PRINTING_ID,
      "pinned",
      "mock-uuid-v7",
      undefined,
    );
  });
});

describe("grant holder scope", () => {
  const PROMO_ID = "00000000-0000-4000-a000-000000000004";

  beforeEach(() => {
    vi.resetAllMocks();
    adminAccess = GRANT_HOLDER;
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingDesk.isDeskPrinting.mockImplementation((id: string) =>
      Promise.resolve(id === PROMO_ID),
    );
    mockPrintingDesk.getFaceLinks.mockResolvedValue({ face1Id: "face-promo", face2Id: null });
    mockPrintingDesk.printingIdsShowingFace.mockResolvedValue([PROMO_ID]);
    mockPrintingImages.faceIdOfImage.mockResolvedValue("face-promo");
    mockAdminEvents.wasPrintingCreatedBy.mockResolvedValue(false);
  });

  it("403s activating an image on a side a printing outside the desk also shows", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({ printingId: PROMO_ID, face: "front" });
    mockPrintingDesk.printingIdsShowingFace.mockResolvedValue([
      PROMO_ID,
      "00000000-0000-4000-a000-000000000009",
    ]);
    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    expect(res.status).toBe(403);
  });

  function uploadTo(printingId: string, mode?: string) {
    const formData = new FormData();
    formData.append("file", new File(["image-data"], "card.png", { type: "image/png" }));
    if (mode !== undefined) {
      formData.append("mode", mode);
    }
    return app.request(`/api/admin/v1/cards/printing/${printingId}/upload-image`, {
      method: "POST",
      body: formData,
    });
  }

  it("403s an upload to a side a printing outside the desk also shows", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: PROMO_ID });
    mockPrintingDesk.printingIdsShowingFace.mockResolvedValue([
      PROMO_ID,
      "00000000-0000-4000-a000-000000000009",
    ]);

    const res = await uploadTo(PROMO_ID);

    expect(res.status).toBe(403);
    expect(mockProcessAndSave).not.toHaveBeenCalled();
  });

  it("403s an upload to a printing outside the desk", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: PRINTING_ID });

    const res = await uploadTo(PRINTING_ID);

    expect(res.status).toBe(403);
    expect(mockProcessAndSave).not.toHaveBeenCalled();
  });

  it("stores an upload to a promo as additional, so it never takes over the live art", async () => {
    mockCatalog.getPrintingById.mockResolvedValue({ id: PROMO_ID });

    const res = await uploadTo(PROMO_ID, "main");

    expect(res.status).toBe(200);
    expect(mockTrxPrintingImages.insertUploadedImage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "additional" }),
    );
  });

  it("403s activating an image on a printing outside the desk", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({
      printingId: PRINTING_ID,
      face: "front",
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });

    expect(res.status).toBe(403);
    expect(mockTrxPrintingImages.setActive).not.toHaveBeenCalled();
  });

  it("lets them activate an image on a promo", async () => {
    mockPrintingImages.getForActivate.mockResolvedValue({ printingId: PROMO_ID, face: "front" });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });

    expect(res.status).toBe(204);
    expect(mockTrxPrintingImages.setActive).toHaveBeenCalledWith(IMAGE_ID, false);
  });

  it("403s rotating an image on a printing outside the desk", async () => {
    mockPrintingImages.getForRehost.mockResolvedValue({
      printingId: PRINTING_ID,
      imageFileId: "if-1",
      originalUrl: null,
      rotation: 0,
      needsTrim: false,
      needsLevels: false,
    });

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation: 90 }),
    });

    expect(res.status).toBe(403);
    expect(mockEditImageFile).not.toHaveBeenCalled();
  });

  it("403s deleting an image on a printing outside the desk, even one they uploaded", async () => {
    mockPrintingImages.getIdAndRehostedUrl.mockResolvedValue({
      printingId: PRINTING_ID,
      rehostedUrl: null,
    });
    mockAdminEvents.imageIdsUploadedBy.mockResolvedValue([IMAGE_ID]);

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(403);
    expect(mockPrintingImages.deleteById).not.toHaveBeenCalled();
  });

  it("lets them delete their own upload on a promo", async () => {
    mockPrintingImages.getIdAndRehostedUrl.mockResolvedValue({
      printingId: PROMO_ID,
      rehostedUrl: null,
    });
    mockAdminEvents.imageIdsUploadedBy.mockResolvedValue([IMAGE_ID]);
    mockPrintingImages.getImageFileId.mockResolvedValue(null);
    mockPrintingImages.deleteById.mockResolvedValue(undefined);

    const res = await app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(mockPrintingImages.deleteById).toHaveBeenCalledWith(IMAGE_ID);
  });
});

describe("image edit scope", () => {
  const OWN_ID = "00000000-0000-4000-a000-000000000005";
  const FOREIGN_ID = "00000000-0000-4000-a000-000000000006";
  const CARD_REVIEW = { isAdmin: false, sections: ["card-review"] };

  const endpoints = [
    { name: "activate", body: { active: true }, effect: () => mockTrxPrintingImages.setActive },
    { name: "rotate", body: { rotation: 90 }, effect: () => mockEditImageFile },
    { name: "rehost", body: undefined, effect: () => mockRefetchImageFile },
    {
      name: "set-needs-trim",
      body: { needsTrim: true },
      effect: () => mockEditImageFile,
    },
    {
      name: "set-needs-levels",
      body: { needsLevels: true },
      effect: () => mockEditImageFile,
    },
  ];

  const cases = [
    { who: "an admin", access: FULL_ADMIN, printingId: FOREIGN_ID, allowed: true },
    { who: "a card-review holder", access: CARD_REVIEW, printingId: FOREIGN_ID, allowed: true },
    {
      who: "a desk-only holder on their own printing",
      access: GRANT_HOLDER,
      printingId: OWN_ID,
      allowed: true,
    },
    {
      who: "a desk-only holder on a foreign printing",
      access: GRANT_HOLDER,
      printingId: FOREIGN_ID,
      allowed: false,
    },
  ];

  function onPrinting(printingId: string) {
    const image = {
      printingId,
      face: "front",
      imageFileId: "if-1",
      originalUrl: "https://example.com/img.png",
      rehostedUrl: "/media/cards/-1/if-1",
      rotation: 0,
      needsTrim: false,
      needsLevels: false,
      quad: null,
    };
    mockPrintingImages.getForActivate.mockResolvedValue(image);
    mockPrintingImages.getForRehost.mockResolvedValue(image);
    mockPrintingImages.faceIdOfImage.mockResolvedValue("face-1");
    mockPrintingDesk.printingIdsShowingFace.mockResolvedValue([printingId]);
    mockRefetchImageFile.mockResolvedValue({ status: "rehosted", imageFileId: "if-2" });
  }

  function call(name: string, body: unknown) {
    return app.request(`/api/admin/v1/cards/printing-images/${IMAGE_ID}/${name}`, {
      method: "POST",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb({ printingImages: mockTrxPrintingImages }));
    mockPrintingDesk.isDeskPrinting.mockResolvedValue(false);
    mockAdminEvents.wasPrintingCreatedBy.mockImplementation((id: string) =>
      Promise.resolve(id === OWN_ID),
    );
  });

  const matrix = endpoints.flatMap((endpoint) =>
    cases.map((entry) => ({
      ...entry,
      endpoint,
      title: `${entry.allowed ? "lets" : "forbids"} ${entry.who} ${endpoint.name}`,
    })),
  );

  it.each(matrix)("$title", async ({ access, printingId, allowed, endpoint }) => {
    adminAccess = access as typeof FULL_ADMIN;
    onPrinting(printingId);

    const res = await call(endpoint.name, endpoint.body);

    expect(res.status < 300).toBe(allowed);
    expect(res.status === 403).toBe(!allowed);
    expect(endpoint.effect().mock.calls.length > 0).toBe(allowed);
  });
});
