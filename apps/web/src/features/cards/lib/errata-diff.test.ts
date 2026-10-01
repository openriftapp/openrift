import { describe, expect, it } from "vitest";

import type { ErrataDiffSegment } from "./errata-diff";
import { diffCardText, diffSide, isBlankSegment } from "./errata-diff";

function render(segments: ErrataDiffSegment[]): string {
  return segments
    .map((segment) => {
      const text = segment.tokens
        .map((token) => {
          if (token.type === "text") {
            return token.value;
          }
          if (token.type === "glyph") {
            return `:${token.name}:`;
          }
          if (token.type === "keyword") {
            return `[${token.name}]`;
          }
          return "\n";
        })
        .join("");
      if (segment.status === "added") {
        return `{+${text}+}`;
      }
      if (segment.status === "removed") {
        return `{-${text}-}`;
      }
      return text;
    })
    .join("");
}

describe("diffCardText", () => {
  it("returns one unchanged segment for identical text", () => {
    const segments = diffCardText("Draw a card.", "Draw a card.");
    expect(segments).toEqual([
      { status: "same", italic: false, tokens: [{ type: "text", value: "Draw a card." }] },
    ]);
  });

  it("marks an inserted phrase as added", () => {
    expect(
      render(diffCardText("your next card costs less.", "the next card you play costs less.")),
    ).toBe("{-your-}{+the+} next card {+you play+} costs less.");
  });

  it("puts removals before additions at a replacement", () => {
    expect(
      render(
        diffCardText("pay :rb_energy_1:. If you do, [Predict].", "pay :rb_energy_1: to [Predict]."),
      ),
    ).toBe("pay :energy_1:{-. If you do,-}  {+to+} [Predict].");
  });

  it("compares glyphs and keywords as whole units", () => {
    expect(render(diffCardText(":rb_might: [Shield]", ":rb_might: [Tank]"))).toBe(
      ":might: {-[Shield]-}{+[Tank]+}",
    );
  });

  it("keeps reminder text italic, parentheses included", () => {
    const segments = diffCardText("Kill it. _(Gone.)_", "Kill it. _(Gone.)_");
    expect(segments.at(-1)).toEqual({
      status: "same",
      italic: true,
      tokens: [{ type: "text", value: "(Gone.)" }],
    });
  });

  it("keeps newlines in place", () => {
    expect(render(diffCardText("A.\nB.", "A.\nC."))).toBe("A.\n{-B-}{+C+}.");
  });
});

describe("diffSide", () => {
  const segments = diffCardText("your next card", "the next card");

  it("drops additions from the printed side", () => {
    expect(render(diffSide(segments, "printed"))).toBe("{-your-} next card");
  });

  it("drops removals from the corrected side", () => {
    expect(render(diffSide(segments, "corrected"))).toBe("{+the+} next card");
  });
});

describe("isBlankSegment", () => {
  it("is true for whitespace-only text", () => {
    expect(
      isBlankSegment({ status: "added", italic: false, tokens: [{ type: "text", value: " " }] }),
    ).toBe(true);
  });

  it("is false once a word or glyph is present", () => {
    expect(
      isBlankSegment({
        status: "added",
        italic: false,
        tokens: [{ type: "glyph", name: "might" }],
      }),
    ).toBe(false);
  });
});
