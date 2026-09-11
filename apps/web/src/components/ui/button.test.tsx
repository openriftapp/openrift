import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "./button";

function controlClasses(): string[] {
  return buttonVariants({ variant: "control" }).split(/\s+/u);
}

describe("control variant", () => {
  it("passes data-active through to the rendered element", () => {
    render(
      <Button variant="control" data-active>
        Languages
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Languages" })).toHaveAttribute("data-active");
  });

  it("omits the attribute when the flag is false", () => {
    const isActive = false;
    render(
      <Button variant="control" data-active={isActive || undefined}>
        Sets
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Sets" })).not.toHaveAttribute("data-active");
  });

  it("resolves both themes from one class, so no dark: fill appears", () => {
    const darkFills = controlClasses().filter(
      (cls) => cls.startsWith("dark:") && cls.includes(":bg-"),
    );
    expect(darkFills).toStrictEqual([]);
  });

  it("gives rest, hover, open and active their own step", () => {
    expect(controlClasses()).toStrictEqual(
      expect.arrayContaining([
        "bg-foreground/5",
        "hover:bg-foreground/10",
        "aria-expanded:bg-foreground/10",
        "data-active:bg-foreground/16",
        "data-active:hover:bg-foreground/24",
      ]),
    );
  });

  it("treats aria-pressed as active, for a Button used as a toggle", () => {
    expect(controlClasses()).toStrictEqual(
      expect.arrayContaining([
        "aria-pressed:bg-foreground/16",
        "aria-pressed:hover:bg-foreground/24",
      ]),
    );
  });
});
