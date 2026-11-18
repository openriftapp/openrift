import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "./dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

/**
 * jsdom does no hit-testing, so these assert the stacking contract: the menu's
 * full-screen backdrop must sit in a z-50 layer opened after the z-50 sheet.
 */
async function backdropLayer() {
  const menu = await screen.findByRole("menu");
  const positioner = menu.parentElement!;
  const backdrop = positioner.previousElementSibling;
  expect(backdrop).toHaveAttribute("data-base-ui-inert");
  return positioner.parentElement!;
}

describe("menu backdrop inside a sheet", () => {
  it("puts the context menu's backdrop in a z-50 layer above the sheet", async () => {
    render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Collections</SheetTitle>
          <ContextMenu defaultOpen>
            <ContextMenuTrigger>Binder</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Edit collection</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </SheetContent>
      </Sheet>,
    );

    expect(await backdropLayer()).toHaveClass("relative", "z-50");
  });

  it("puts the dropdown menu's backdrop in a z-50 layer above the sheet", async () => {
    render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Collections</SheetTitle>
          <DropdownMenu defaultOpen>
            <DropdownMenuContent>
              <DropdownMenuItem>Edit collection</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SheetContent>
      </Sheet>,
    );

    expect(await backdropLayer()).toHaveClass("relative", "z-50");
  });
});
