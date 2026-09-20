import { describe, expect, it } from "vitest";

import { toggleVariants } from "@/components/ui/toggle";

describe("toggleVariants", () => {
  it("gives the outline variant the same fill ladder as control", () => {
    expect(toggleVariants({ variant: "outline" })).toBe(toggleVariants({ variant: "control" }));
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
