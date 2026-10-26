import { describe, expect, it } from "vitest";

import { imageShardDir, imageUrl } from "./image-url.js";

describe("imageUrl", () => {
  it("names the file by id and variant with no shard directory", () => {
    expect(imageUrl("019d02f1-d14f-769f-9295-9852db692dbe", "full")).toBe(
      "/media/cards/019d02f1-d14f-769f-9295-9852db692dbe-full.webp",
    );
  });

  it("names the file after the requested variant", () => {
    const id = "019d02f1-d14f-769f-9295-9852db692dbe";
    expect(imageUrl(id, "120w")).toBe(`/media/cards/${id}-120w.webp`);
    expect(imageUrl(id, "240w")).toBe(`/media/cards/${id}-240w.webp`);
    expect(imageUrl(id, "400w")).toBe(`/media/cards/${id}-400w.webp`);
  });
});

describe("imageShardDir", () => {
  it("is the id's last two hex characters", () => {
    expect(imageShardDir("019d02f1-d14f-769f-9295-9852db692dbe")).toBe("be");
  });

  it("is the whole id when it is shorter than two characters", () => {
    expect(imageShardDir("a")).toBe("a");
  });
});
