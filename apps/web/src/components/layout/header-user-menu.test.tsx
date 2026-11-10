import type * as ReactQuery from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { cloneElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeStore } from "@/stores/theme-store";
import { createStoreResetter } from "@/test/store-helpers";

const admin = vi.hoisted(() => ({
  access: undefined as { isAdmin: boolean; sections: string[] } | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ navigate: vi.fn() }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQueryClient: () => ({}),
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: admin.access }),
}));

vi.mock("@/features/account/hooks/use-preferences-sync", () => ({
  applyDisplayLocale: vi.fn(async () => true),
}));

type Slot = ReactElement<{ className?: string; children?: ReactNode }>;

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    render: element,
    onClick,
    children,
  }: {
    render?: Slot;
    onClick?: () => void;
    children?: ReactNode;
  }) =>
    element ? (
      cloneElement(element, { children })
    ) : (
      <div role="menuitem" tabIndex={-1} onClick={onClick} onKeyDown={onClick}>
        {children}
      </div>
    ),
  DropdownMenuSeparator: ({ className }: { className?: string }) => (
    <hr data-testid="separator" className={className} />
  ),
  DropdownMenuSub: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({
    className,
    children,
  }: {
    className?: string;
    children?: ReactNode;
  }) => (
    <div data-testid="submenu-trigger" className={className}>
      {children}
    </div>
  ),
  DropdownMenuSubContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { UserMenuItems } from "./header";

const resetTheme = createStoreResetter(useThemeStore);

beforeEach(() => {
  resetTheme();
  admin.access = undefined;
});
afterEach(resetTheme);

function renderMenu(isLoggedIn: boolean) {
  return render(<UserMenuItems isLoggedIn={isLoggedIn} onLockedClick={() => {}} />);
}

function submenuTrigger(name: string): HTMLElement {
  const trigger = screen
    .getAllByTestId("submenu-trigger")
    .find((element) => element.textContent === name);
  if (!trigger) {
    throw new Error(`no submenu ${name}`);
  }
  return trigger;
}

describe("UserMenuItems", () => {
  it("lists Profile, Language, Theme and Sign out for a signed-in visitor", () => {
    renderMenu(true);
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile");
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    expect(submenuTrigger("Language")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^Theme/u })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("adds Admin for an admin", () => {
    admin.access = { isAdmin: true, sections: [] };
    renderMenu(true);
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
  });

  it("keeps Language and Theme for a signed-out visitor", () => {
    renderMenu(false);
    expect(submenuTrigger("Language")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^Theme/u })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull();
  });

  it("has no Help submenu and shows Contribute only between md and lg", () => {
    for (const isLoggedIn of [true, false]) {
      const { unmount } = renderMenu(isLoggedIn);
      expect(screen.queryByText("Help")).toBeNull();
      expect(submenuTrigger("Contribute").className).toContain("hidden md:flex lg:hidden");
      unmount();
    }
  });

  it("cycles the theme preference through the store the profile page writes", () => {
    useThemeStore.setState({ preference: "dark" });
    renderMenu(true);
    const row = screen.getByRole("menuitem", { name: /^Theme/u });
    expect(row.textContent).toBe("ThemeDark");

    fireEvent.click(row);
    expect(useThemeStore.getState().preference).toBe("light");
    expect(row.textContent).toBe("ThemeLight");

    fireEvent.click(row);
    expect(useThemeStore.getState().preference).toBe("auto");
    expect(row.textContent).toBe("ThemeAuto");
  });
});
