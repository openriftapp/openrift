import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(SRC, dir), { recursive: true, encoding: "utf-8" })
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(dir, file));
}

function filesMatching(dir: string, pattern: RegExp, allowed: string[]): string[] {
  return sourceFiles(dir).filter(
    (file) => !allowed.includes(file) && pattern.test(readFileSync(path.join(SRC, file), "utf-8")),
  );
}

describe("source conventions", () => {
  it("creates printings only through insertNewPrinting", () => {
    const offenders = filesMatching("modules", /\.insertPrinting\(/u, [
      "modules/catalog/services/printing-admin.ts",
    ]);

    expect(offenders).toEqual([]);
  });

  it("sends meta source HTTP only through paced-http", () => {
    const offenders = filesMatching("modules/meta", /\bfetch\(/u, [
      "modules/meta/services/meta-sync/paced-http.ts",
    ]);

    expect(offenders).toEqual([]);
  });

  it("reaches image files, face image rows and fallback file ids only in admin, grant-holder and catalog-write code", () => {
    const pattern =
      /\b(?:imageFiles|image_files|originalUrl|original_url|rehostedUrl|rehosted_url|imageUrlWithOriginal|joinAdminFaceImage|faceImages|face_images|imageFileId|image_file_id|fallbackImageFileId|fallback_image_file_id)\b/u;
    const allowed = new Set([
      "db/catalog-sync-writer.ts",
      "db/catalog-sync.ts",
      "db/tables.ts",
      "db/tables/catalog.ts",
      "db/tables/views.ts",
      "repositories/query-helpers.ts",
      "modules/candidates/lib/candidate-export.ts",
      "modules/candidates/lib/workspace-presenters.ts",
      "modules/candidates/repositories/candidate-cards-detail.ts",
      "modules/candidates/repositories/candidate-cards-export.ts",
      "modules/candidates/repositories/candidate-cards-fingerprints.ts",
      "modules/candidates/repositories/candidate-cards-source-list.ts",
      "modules/candidates/repositories/candidate-comparison-sql.ts",
      "modules/candidates/repositories/workspace-queue.ts",
      "modules/candidates/repositories/workspace-records.ts",
      "modules/catalog/lib/printing-desk-presenters.ts",
      "modules/catalog/repositories/catalog-mutations.ts",
      "modules/catalog/repositories/printing-desk.ts",
      "modules/catalog/repositories/printing-images.ts",
      "modules/catalog/routes/admin-cards-images.ts",
      "modules/catalog/routes/admin-printing-desk.ts",
      "modules/catalog/routes/admin-printing-post-image.ts",
      "modules/catalog/services/images/fingerprint-sweep.ts",
      "modules/catalog/services/images/jobs.ts",
      "modules/catalog/services/images/maintenance.ts",
      "modules/catalog/services/images/upload.ts",
      "modules/catalog/services/images/variants.ts",
      "modules/catalog/services/printing-admin.ts",
      "modules/catalog/services/printing-desk.ts",
      "modules/catalog/services/printing-post-image.ts",
      "modules/marketplace/repositories/marketplace-mapping-cards.ts",
    ]);
    const offenders = ["modules", "repositories", "lib", "db"]
      .flatMap((dir) => sourceFiles(dir))
      .filter(
        (file) =>
          !allowed.has(file) &&
          !file.startsWith("db/migrations/") &&
          pattern.test(readFileSync(path.join(SRC, file), "utf-8")),
      );

    expect(offenders).toEqual([]);
  });

  it("keeps upstream image URLs out of public and signed-in route files", () => {
    const routeFiles = sourceFiles("modules").filter((file) =>
      /^modules\/[^/]+\/routes\/(?:public|authenticated)-[^/]+\.ts$/u.test(file),
    );
    const offenders = routeFiles.filter((file) =>
      /\b(?:originalUrl|original_url|rehostedUrl|rehosted_url)\b/u.test(
        readFileSync(path.join(SRC, file), "utf-8"),
      ),
    );

    expect(routeFiles.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("keeps day and hour constants in meta-durations", () => {
    const offenders = filesMatching("modules/meta", /const (?:DAY_MS|MS_PER_DAY|HOUR_MS)\b/u, [
      "modules/meta/lib/meta-durations.ts",
    ]);

    expect(offenders).toEqual([]);
  });
});
