import { describe, expect, it } from "vitest";

import { parseShareImageQuery } from "./share-image-query.js";

function queryOf(params: Record<string, string>) {
  return (name: string) => params[name];
}

describe("parseShareImageQuery", () => {
  it("defaults to scale 1, landscape, with a QR", () => {
    expect(parseShareImageQuery(queryOf({}))).toEqual({
      scale: 1,
      aspect: "landscape",
      qr: true,
    });
  });

  it("reads scale, aspect and qr", () => {
    expect(parseShareImageQuery(queryOf({ scale: "3", aspect: "vertical", qr: "0" }))).toEqual({
      scale: 3,
      aspect: "vertical",
      qr: false,
    });
  });

  it("maps the legacy size=hq to scale 2", () => {
    expect(parseShareImageQuery(queryOf({ size: "hq" })).scale).toBe(2);
  });

  it("ignores an out-of-range scale", () => {
    expect(parseShareImageQuery(queryOf({ scale: "9" })).scale).toBe(1);
  });
});
