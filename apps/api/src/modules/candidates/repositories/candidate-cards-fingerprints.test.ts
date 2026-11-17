import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { candidateFingerprintsRepo } from "./candidate-cards-fingerprints.js";

describe("listPrintingsNeedingFingerprint", () => {
  it("skips a URL whose last failure is still backing off and serves the oldest attempts first", async () => {
    const { db, queries } = createRecordingDb([[]]);

    await candidateFingerprintsRepo(db).listPrintingsNeedingFingerprint(10);

    const [query] = queries;
    expect(query).toContain(
      'left join "candidate_fingerprint_failures" as "ff" on "ff"."candidate_printing_id" = "cp"."id" and "ff"."image_url" = "cp"."image_url"',
    );
    expect(query).toContain('"ff"."attempts" IS NULL');
    expect(query).toMatch(/power\(2, least\("ff"\."attempts" - 1, 10\)\)/u);
    expect(query).toMatch(/order by ff\.last_attempt_at asc nulls first, "cp"\."id"/u);
  });
});

describe("setImageFingerprint", () => {
  it("clears the candidate's failure row in the same statement", async () => {
    const { db, queries, parameters } = createRecordingDb();

    await candidateFingerprintsRepo(db).setImageFingerprint("cp-1", "https://x/a.png", null);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(
      /^with "cleared" as \(delete from "candidate_fingerprint_failures" where "candidate_printing_id" = \$1\) update "candidate_printings"/u,
    );
    expect(parameters[0]).toEqual(["cp-1", null, "https://x/a.png", "cp-1"]);
  });
});

describe("recordFingerprintFailure", () => {
  it("counts attempts per URL and returns the new count", async () => {
    const { db, queries } = createRecordingDb([[{ attempts: 3 }]]);

    const attempts = await candidateFingerprintsRepo(db).recordFingerprintFailure(
      "cp-1",
      "https://x/a.png",
      "timeout",
    );

    expect(attempts).toBe(3);
    expect(queries[0]).toContain('on conflict ("candidate_printing_id") do update set');
    expect(queries[0]).toContain(
      "case when candidate_fingerprint_failures.image_url = excluded.image_url then candidate_fingerprint_failures.attempts + 1 else 1 end",
    );
    expect(queries[0]).toContain('returning "attempts"');
  });
});
