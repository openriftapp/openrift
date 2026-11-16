import { describe, expect, it } from "vitest";

import { readBuildId } from "./build-id.js";

describe("readBuildId", () => {
  it("prefers BUILD_ID from the environment", () => {
    expect(readBuildId({ BUILD_ID: "abc1234" }, () => "file1234")).toBe("abc1234");
  });

  it("reads the hash the Dockerfile wrote", () => {
    expect(readBuildId({}, () => "def5678\n")).toBe("def5678");
  });

  it("is undefined outside a container", () => {
    expect(
      readBuildId({}, () => {
        throw new Error("ENOENT");
      }),
    ).toBeUndefined();
  });
});
