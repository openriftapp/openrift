import { describe, expect, it } from "vitest";

import { toggleVariants } from "@/components/ui/toggle";

describe("toggleVariants", () => {
  it("scopes the outline variant's dark fills to the unpressed state", () => {
    const darkFills = toggleVariants({ variant: "outline" })
      .split(/\s+/u)
      .filter((cls) => cls.startsWith("dark:") && cls.includes(":bg-"));
    expect(darkFills.length).toBeGreaterThan(0);
    for (const cls of darkFills) {
      expect(cls).toMatch(/^dark:not-aria-pressed:/u);
    }
  });

  it("resolves the control variant from one class per state, with no dark: fill", () => {
    const classes = toggleVariants({ variant: "control" }).split(/\s+/u);
    const darkFills = classes.filter((cls) => cls.startsWith("dark:") && cls.includes(":bg-"));
    expect(darkFills).toStrictEqual([]);
    expect(classes).toStrictEqual(
      expect.arrayContaining([
        "bg-foreground/5",
        "hover:bg-foreground/10",
        "aria-pressed:bg-foreground/16",
        "aria-pressed:hover:bg-foreground/24",
      ]),
    );
  });
});
