import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./user-avatar";

describe("UserAvatar", () => {
  it("renders the initials fallback when nothing is provided", () => {
    const { container } = render(<UserAvatar name="Ada Lovelace" />);
    expect(container.textContent).toBe("AL");
  });
});
