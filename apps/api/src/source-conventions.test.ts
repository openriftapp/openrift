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

  it("takes day and hour lengths from the shared date module", () => {
    const offenders = filesMatching(
      ".",
      /\b(?:24 \* 60 \* 60 \* 1000|60 \* 60 \* 1000|86_?400_?000|3_?600_?000)\b|const (?:DAY_MS|HOUR_MS|MS_PER_DAY|MS_PER_HOUR)\b/u,
      [],
    );

    expect(offenders).toEqual([]);
  });

  it("reads a UTC day key through formatDay", () => {
    expect(filesMatching(".", /\.toISOString\(\)\.slice\(0, 10\)/u, [])).toEqual([]);
  });

  it("pluralizes through the shared pluralize", () => {
    expect(
      filesMatching(
        ".",
        /(?:[=!]==|>) 1 \? "s?" : "s?"|(?:[=!]==|>) 1 \? "(?<stem>[a-z]{3})[a-z ]*" : "\k<stem>[a-z ]*"|function plural\(/u,
        [],
      ),
    ).toEqual([]);
  });

  it("omits a missing owner name instead of naming it", () => {
    expect(filesMatching(".", /"Anonymous"/u, [])).toEqual([]);
  });

  it("labels deck formats and list intents through the label sources", () => {
    expect(filesMatching(".", /\bsentenceCaseSlug\b|\$\{[\w.]*intent\} list/u, [])).toEqual([]);
  });

  it("builds card lookups only through the shared lookup builders", () => {
    expect(
      filesMatching(
        ".",
        /import \{[^}]*\b(?:buildCardIndex|cardSearchAltNames)\b[^}]*\} from "@openrift\/shared\/card-(?:search|name)"|import \* as \w+ from "@openrift\/shared\/card-(?:search|name)"|export \{[^}]*\bbuildCardIndex\b/u,
        [],
      ),
    ).toEqual([]);
  });

  it("builds card page links only through cardPath and cardUrl", () => {
    expect(filesMatching(".", /`[^`]*(?<!media)\/cards\/\$\{|"\/cards\/" *\+/u, [])).toEqual([]);
  });

  it("names a card in a player-facing string through legendDisplayName", () => {
    expect(
      filesMatching("modules", /\$\{[\w?.]*\bcard\??\.name\}/u, [
        "modules/candidates/services/ingest-candidates.ts",
        "modules/meta/services/meta-submission.ts",
      ]),
    ).toEqual([]);
  });

  it("bylines a share image only through the shared title block", () => {
    expect(
      filesMatching("modules", /`by \$\{/u, [
        "modules/system/services/share-image-frame.ts",
      ]).filter((file) => file.includes("image")),
    ).toEqual([]);
  });

  it("takes the card aspect ratio from the shared constant", () => {
    expect(filesMatching(".", /\b0\.71\d\b|ASPECT\s*=\s*1\.4\b/u, [])).toEqual([]);
  });

  it("reads share-image size and QR params only through parseShareImageQuery", () => {
    expect(
      filesMatching(".", /c\.req\.query\("(?:size|qr|scale)"\)/u, [
        "modules/catalog/routes/admin-printing-post-image.ts",
      ]),
    ).toEqual([]);
  });

  it("throws the four common errors through the error helpers", () => {
    expect(filesMatching(".", /new AppError\(\s*(?:400|403|404|409)\b/u, ["errors.ts"])).toEqual(
      [],
    );
  });

  it("names the site host only through the configured origin", () => {
    expect(filesMatching(".", /(?<!@)openrift\.app/u, [])).toEqual([]);
  });

  it("builds marketplace SKU keys only through skuKey and marketplaceSkuKey", () => {
    expect(filesMatching(".", /\$\{[^}`]*externalId\}::\$\{[^}`]*finish\}::/u, [])).toEqual([]);
  });

  it("records an admin event in every write handler of the marketplace admin routes", () => {
    const files = [
      ...sourceFiles("modules/marketplace/routes").filter((file) =>
        path.basename(file).startsWith("admin-"),
      ),
      "modules/candidates/routes/admin-staging-card-overrides.ts",
    ];
    const handler = /\bos\.(?<name>\w+)\.handler\(/gu;
    const silent: string[] = [];
    let writers = 0;
    for (const file of files) {
      const source = readFileSync(path.join(SRC, file), "utf-8");
      const starts = [...source.matchAll(handler)];
      for (const [index, match] of starts.entries()) {
        const name = match.groups?.name ?? "";
        if (["list", "summary", "card"].includes(name)) {
          continue;
        }
        writers += 1;
        const body = source.slice(match.index, starts[index + 1]?.index ?? source.length);
        if (!/\brecordAdminEvents?\(/u.test(body)) {
          silent.push(`${file}#${name}`);
        }
      }
    }

    expect(writers).toBeGreaterThan(0);
    expect(silent).toEqual([]);
  });
});

describe("generic helpers", () => {
  it("reads thrown errors only through the shared error helpers", () => {
    expect(
      filesMatching(
        ".",
        /instanceof Error \? \w+\.message\b|instanceof Error \? \w+ : new Error\(/u,
        [],
      ),
    ).toEqual([]);
  });

  it("splits arrays only through chunk", () => {
    expect(
      filesMatching(
        ".",
        /for \(let (?<step>\w+) = 0; \k<step> < [\w.]+\.length; \k<step> \+= [A-Z][A-Z_]*\)/u,
        [],
      ),
    ).toEqual([]);
  });

  it("defines clamp and sleep only in the shared modules", () => {
    expect(filesMatching(".", /function clamp\(|setTimeout\(resolve, \w+\)/u, [])).toEqual([]);
  });
});
