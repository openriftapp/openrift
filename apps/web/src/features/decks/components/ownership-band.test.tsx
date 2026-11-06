import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LabeledOwnershipBand } from "./ownership-band";

describe("LabeledOwnershipBand", () => {
  it("labels each present segment and sizes it by copy count", () => {
    render(
      <LabeledOwnershipBand
        quantity={3}
        band={{ exact: 2, other: 0, borrowed: 0, locked: 0, missing: 1 }}
      />,
    );
    expect(screen.getByText("Owned").style.flexGrow).toBe("2");
    expect(screen.getByText("Missing").style.flexGrow).toBe("1");
    expect(screen.queryByText("Borrowed")).toBeNull();
  });
});
