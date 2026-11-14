import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscordVignette } from "./discord-vignette";

describe("DiscordVignette", () => {
  it("lists a price for every marketplace the bot reports", () => {
    render(<DiscordVignette />);

    for (const marketplace of ALL_MARKETPLACES) {
      expect(screen.getByText(MARKETPLACE_LINKS[marketplace].label)).toBeInTheDocument();
    }
  });
});
