import { BUILD_ID_HEADER } from "@openrift/shared/contracts/api-format";
import { describe, expect, it } from "vitest";

import { COMMIT_HASH } from "@/lib/env";

import { stampBuildId } from "./build-id";

function responseWith(cacheControl?: string): Response {
  return new Response(null, {
    headers: cacheControl === undefined ? {} : { "Cache-Control": cacheControl },
  });
}

describe("stampBuildId", () => {
  it("stamps a response without a Cache-Control header", () => {
    const response = responseWith();
    stampBuildId(response);
    expect(response.headers.get(BUILD_ID_HEADER)).toBe(COMMIT_HASH);
  });

  it("stamps a no-store response", () => {
    const response = responseWith("private, no-store");
    stampBuildId(response);
    expect(response.headers.get(BUILD_ID_HEADER)).toBe(COMMIT_HASH);
  });

  it("leaves a response with immutable headers alone", () => {
    const response = Response.redirect("https://openrift.app/", 302);
    expect(() => {
      stampBuildId(response);
    }).not.toThrow();
  });

  it("leaves a cacheable response unstamped", () => {
    const response = responseWith("public, max-age=3600");
    stampBuildId(response);
    expect(response.headers.get(BUILD_ID_HEADER)).toBeNull();
  });
});
