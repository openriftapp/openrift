import { describe, expect, it } from "vitest";

import { textsOf } from "../../../test/share-image-tree.js";
import { SHARE_TYPE, hostFooter, titleAreaHeight, titleBlock } from "./share-image-frame.js";

describe("titleBlock", () => {
  it.each(["landscape", "vertical"] as const)(
    "bylines a named owner on the %s canvas",
    (aspect) => {
      const texts = textsOf(
        titleBlock({
          aspect,
          title: "Summoner Skirmish",
          ownerName: "Poro",
          meta: "Deck",
          height: 60,
        }),
      );
      expect(texts).toEqual(["Summoner Skirmish", "by Poro", "Deck"]);
    },
  );

  it.each(["landscape", "vertical"] as const)(
    "omits the byline without an owner on the %s canvas",
    (aspect) => {
      const texts = textsOf(titleBlock({ aspect, title: "Summoner Skirmish", height: 60 }));
      expect(texts).toEqual(["Summoner Skirmish"]);
    },
  );

  it("elides the title at the canvas cap unless the caller sets one", () => {
    const long = "A".repeat(60);
    const [landscape] = textsOf(titleBlock({ aspect: "landscape", title: long, height: 60 }));
    const [capped] = textsOf(
      titleBlock({ aspect: "landscape", title: long, maxChars: 20, height: 60 }),
    );
    expect(landscape).toHaveLength(SHARE_TYPE.landscape.titleMaxChars);
    expect(capped).toHaveLength(20);
  });
});

describe("titleAreaHeight", () => {
  it("grows to the header QR only when there is one", () => {
    expect(titleAreaHeight("landscape", false)).toBe(SHARE_TYPE.landscape.titleH);
    expect(titleAreaHeight("landscape", true)).toBe(SHARE_TYPE.landscape.headerQr);
    expect(titleAreaHeight("vertical", true, 200)).toBe(200);
  });
});

describe("hostFooter", () => {
  it.each(["landscape", "vertical"] as const)(
    "sizes the %s footer from the canvas type scale",
    (aspect) => {
      const footer = hostFooter({ siteHost: "example.test", aspect, marginTop: 10 });
      expect(footer.props.style).toMatchObject({ height: SHARE_TYPE[aspect].footerH });
      expect(textsOf(footer)).toEqual(["example.test"]);
    },
  );
});
