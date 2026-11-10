import type { DisplayLocale, Theme } from "@openrift/shared/types/api/preferences";
import { DISPLAY_LOCALES, PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useMatch, useRouter } from "@tanstack/react-router";
import {
  EllipsisVerticalIcon,
  LanguagesIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { ContributePopover, ContributeSubmenu, HelpPopover } from "@/components/layout/help-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
import type { NavFlags } from "@/components/layout/nav-items";
import {
  badgeAriaLabel,
  keepsSearch,
  SignInRequiredDialog,
  splitTabletNav,
  visibleMoreSections,
  visiblePrimaryItems,
} from "@/components/layout/nav-items";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLabel,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { UserAvatar } from "@/components/user-avatar";
import { applyDisplayLocale } from "@/features/account/hooks/use-preferences-sync";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useBadges } from "@/features/groups/hooks/use-badges";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useGravatarHash } from "@/hooks/use-gravatar-hash";
import { useSession } from "@/hooks/use-session";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";
import type { LockedFeatureKey, NavBadgeCounts, NavItemConfig } from "@/lib/nav-items";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { toastError } from "@/lib/toast";
import { cn, CONTAINER_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { leaveAsSignedOut, loadClientStateReset } from "@/stores/leave-as-signed-out";
import { useThemeStore } from "@/stores/theme-store";

const THEME_LABELS: Record<Theme, () => string> = {
  auto: m.profile_display_theme_auto,
  light: m.profile_display_theme_light,
  dark: m.profile_display_theme_dark,
};

function LogoLink({ className }: { className?: string }) {
  const isHome = useMatch({ from: "/_app/cards", shouldThrow: false });

  return (
    <Link
      to="/cards"
      className={cn("flex shrink-0 items-center gap-2", className)}
      onClick={(e) => {
        if (isHome) {
          e.preventDefault();
          globalThis.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      <img src="/logo-color.svg" alt="OpenRift" className="size-8" />
      <span className="font-heading text-xl font-bold">OpenRift</span>
    </Link>
  );
}

export function navBadgeTotal(badges: NavBadgeCounts): number {
  return badges.groups + badges.trades + badges.loans;
}

function MenuButton({
  onClick,
  badgeCount,
  className,
}: {
  onClick: () => void;
  badgeCount: number;
  className?: string;
}) {
  const badgeId = useId();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.layout_header_open_menu()}
      aria-describedby={badgeCount > 0 ? badgeId : undefined}
      className={cn("relative", className)}
      onClick={onClick}
    >
      <MenuIcon className="size-5" />
      {badgeCount > 0 && (
        <NavCountBadge
          id={badgeId}
          count={badgeCount}
          label={m.layout_header_section_attention({ section: m.layout_header_menu() })}
          className="absolute -top-1 -right-1"
        />
      )}
    </Button>
  );
}

// Pill background is hover/focus-only, active is text-only, or an active item
// next to a hovered one renders as two same-color pills fused at their corners.
const DESKTOP_NAV_ITEM_CLASS = cn(
  navigationMenuTriggerStyle(),
  "text-muted-foreground hover:text-foreground focus:text-foreground data-[status=active]:text-foreground data-[status=active]:font-semibold",
);

function DesktopPrimaryItem({
  item,
  isLoggedIn,
  badges,
  onLockedClick,
}: {
  item: NavItemConfig;
  isLoggedIn: boolean;
  badges: NavBadgeCounts;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const lockedKey = item.lockedKey;
  const keepSearch = useLocation({ select: (location) => keepsSearch(item, location.pathname) });
  if (lockedKey && !isLoggedIn) {
    return (
      <NavigationMenuLink
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bare render slot; NavigationMenuLink owns all styling and provides the label as children
        render={<button type="button" onClick={() => onLockedClick(lockedKey)} />}
        className={DESKTOP_NAV_ITEM_CLASS}
      >
        {item.label}
      </NavigationMenuLink>
    );
  }
  const badgeCount = item.badge ? badges[item.badge] : 0;
  return (
    <NavigationMenuLink
      render={<Link to={item.to} search={keepSearch ? (prev) => prev : undefined} />}
      className={DESKTOP_NAV_ITEM_CLASS}
    >
      {item.label}
      {item.badge && badgeCount > 0 && (
        <NavCountBadge
          count={badgeCount}
          label={badgeAriaLabel(item.badge, badgeCount)}
          className="ml-1.5"
        />
      )}
    </NavigationMenuLink>
  );
}

function DesktopMoreItem({
  item,
  isLoggedIn,
  badges,
  onLockedClick,
}: {
  item: NavItemConfig;
  isLoggedIn: boolean;
  badges: NavBadgeCounts;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const lockedKey = item.lockedKey;
  const badgeCount = item.badge ? badges[item.badge] : 0;
  const content = (
    <>
      <item.icon />
      <div>
        <div className="font-medium">
          {item.label}
          {item.badge && badgeCount > 0 && (
            <NavCountBadge
              count={badgeCount}
              label={badgeAriaLabel(item.badge, badgeCount)}
              className="ml-1.5"
            />
          )}
        </div>
        <div className="text-muted-foreground text-xs">{item.description}</div>
      </div>
    </>
  );
  if (lockedKey && !isLoggedIn) {
    return (
      <NavigationMenuLink
        closeOnClick
        // A native <button> shrinks to its content and centers its text; force
        // it to fill and left-align so it matches the <Link>-rendered rows.
        className="w-full text-left"
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bare render slot; NavigationMenuLink owns all styling and provides the label as children
        render={<button type="button" onClick={() => onLockedClick(lockedKey)} />}
      >
        {content}
      </NavigationMenuLink>
    );
  }
  return (
    <NavigationMenuLink closeOnClick render={<Link to={item.to} />}>
      {content}
    </NavigationMenuLink>
  );
}

function DesktopNav({
  isLoggedIn,
  flags,
  badges,
  onLockedClick,
}: {
  isLoggedIn: boolean;
  flags: NavFlags;
  badges: NavBadgeCounts;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const primary = visiblePrimaryItems({ flags, mobile: false, badges });
  const { overflow } = splitTabletNav(primary);
  const overflowBadgeCount = overflow.reduce(
    (sum, item) => sum + (item.badge ? badges[item.badge] : 0),
    0,
  );
  return (
    <NavigationMenu>
      <NavigationMenuList className="gap-1">
        {primary.map((item) => (
          <NavigationMenuItem
            key={item.to}
            className={cn(overflow.includes(item) && "hidden lg:block")}
          >
            <DesktopPrimaryItem
              item={item}
              isLoggedIn={isLoggedIn}
              badges={badges}
              onLockedClick={onLockedClick}
            />
          </NavigationMenuItem>
        ))}
        <NavigationMenuItem>
          <NavigationMenuTrigger className="text-muted-foreground hover:text-foreground focus:text-foreground data-popup-open:text-foreground">
            {m.layout_header_more()}
            {overflowBadgeCount > 0 && (
              <NavCountBadge
                count={overflowBadgeCount}
                label={m.layout_header_section_attention({ section: m.layout_header_more() })}
                className="ml-1.5 lg:hidden"
              />
            )}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            {/* CSS columns pack the sections side by side; break-inside-avoid
                keeps each section whole so a group never splits mid-column. */}
            <div className="w-[34rem] columns-2 gap-2 p-2">
              {visibleMoreSections({ flags, mobile: false, badges }).map((section) => (
                <section key={section.id} className="mb-3 break-inside-avoid last:mb-0">
                  <NavigationMenuLabel>{section.label}</NavigationMenuLabel>
                  <ul className="grid gap-1">
                    {section.id === "organize" &&
                      overflow.map((item) => (
                        <li key={item.to} className="lg:hidden">
                          <DesktopMoreItem
                            item={item}
                            isLoggedIn={isLoggedIn}
                            badges={badges}
                            onLockedClick={onLockedClick}
                          />
                        </li>
                      ))}
                    {section.items.map((item) => (
                      <li key={item.to}>
                        <DesktopMoreItem
                          item={item}
                          isLoggedIn={isLoggedIn}
                          badges={badges}
                          onLockedClick={onLockedClick}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function UserMenuTrigger({
  user,
}: {
  user: { name: string; email: string; image?: string | null } | undefined;
}) {
  const gravatarHash = useGravatarHash(user?.email);
  if (user) {
    return (
      <UserAvatar
        image={user.image}
        name={user.name}
        email={user.email}
        gravatarHash={gravatarHash}
        size="sm"
      />
    );
  }
  return <EllipsisVerticalIcon className="size-5" />;
}

// Loaded on click so the auth client stays out of the shell's entry chunk.
async function signOutViaAuthClient(): Promise<void> {
  const { signOut } = await import("@/features/account/lib/auth-client");
  await signOut();
}

function LanguageSubmenu({ isLoggedIn }: { isLoggedIn: boolean }) {
  const active = getLocale();

  const change = async (next: DisplayLocale) => {
    if (!(await applyDisplayLocale(next, { persist: isLoggedIn }))) {
      toastError(m.profile_display_locale_error());
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <LanguagesIcon className="size-4" />
        {m.locale_switcher_label()}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={active} onValueChange={(next) => void change(next)}>
          {DISPLAY_LOCALES.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {DISPLAY_LOCALE_LABELS[locale]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function UserMenuItems({
  isLoggedIn,
  onLockedClick,
}: {
  isLoggedIn: boolean;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const themePreference = useThemeStore((s) => s.preference ?? PREFERENCE_DEFAULTS.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const darkMode = theme === "dark";
  const { data: adminAccess } = useAdminAccess();
  const hasAdminAccess =
    adminAccess !== undefined && (adminAccess.isAdmin || adminAccess.sections.length > 0);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const reset = loadClientStateReset();
      await signOutViaAuthClient();
      await leaveAsSignedOut(
        queryClient,
        () => router.navigate({ to: "/cards", search: {} }),
        reset,
      );
    } catch {
      toastError(m.layout_header_sign_out_failed());
    }
  };

  return (
    <DropdownMenuContent align="end">
      {isLoggedIn && (
        <DropdownMenuItem render={<Link to="/profile" />}>
          <UserIcon className="size-4" />
          {m.layout_header_profile()}
        </DropdownMenuItem>
      )}
      {isLoggedIn && hasAdminAccess && (
        <DropdownMenuItem render={<Link to="/admin" />}>
          <ShieldIcon className="size-4" />
          {m.layout_header_admin()}
        </DropdownMenuItem>
      )}
      {isLoggedIn && <DropdownMenuSeparator />}
      <ContributeSubmenu isLoggedIn={isLoggedIn} onLockedClick={onLockedClick} />
      <DropdownMenuSeparator className="hidden md:block lg:hidden" />
      <LanguageSubmenu isLoggedIn={isLoggedIn} />
      <DropdownMenuItem closeOnClick={false} onClick={toggleTheme}>
        {darkMode ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
        {m.profile_display_theme()}
        <span className="text-muted-foreground ml-auto pl-4">
          {THEME_LABELS[themePreference]()}
        </span>
      </DropdownMenuItem>
      {isLoggedIn && <DropdownMenuSeparator />}
      {isLoggedIn && (
        <DropdownMenuItem onClick={() => void handleSignOut()}>
          <LogOutIcon className="size-4" />
          {m.layout_header_sign_out()}
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );
}

// The header hides its Sign in button on these pages.
const AUTH_PAGES: ReadonlySet<string> = new Set([
  "/login",
  "/signup",
  "/reset-password",
  "/verify-email",
]);
// Signing in from one of these bounces through an auth page or the marketing
// page, so they carry no redirect and fall through to the post-sign-in default.
const NO_SIGN_IN_REDIRECT: ReadonlySet<string> = new Set(["/", ...AUTH_PAGES]);

export function showsSignInButton(pathname: string): boolean {
  return !AUTH_PAGES.has(pathname);
}

/** Picks the `redirect` the header's Sign in button carries from the current location. */
export function signInRedirectFor(location: {
  pathname: string;
  href: string;
}): string | undefined {
  return NO_SIGN_IN_REDIRECT.has(location.pathname) ? undefined : location.href;
}

function UserMenu({
  session,
  isPending,
  onLockedClick,
}: {
  session: ReturnType<typeof useSession>["data"];
  isPending: boolean;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const isLoggedIn = Boolean(session?.user);
  const signInRedirect = useLocation({ select: signInRedirectFor });
  const showSignIn = useLocation({ select: (location) => showsSignInButton(location.pathname) });

  if (isPending) {
    return <div className="size-(--control-h)" />;
  }

  const user = session?.user;

  return (
    <div className="flex items-center gap-2">
      {!user && showSignIn && (
        <Link
          rel="nofollow"
          to="/login"
          search={{ redirect: signInRedirect, email: undefined }}
          className={buttonVariants({ size: "sm" })}
        >
          {m.common_sign_in()}
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={m.layout_header_menu()} />}
        >
          <UserMenuTrigger user={user} />
        </DropdownMenuTrigger>
        <UserMenuItems isLoggedIn={isLoggedIn} onLockedClick={onLockedClick} />
      </DropdownMenu>
    </div>
  );
}

// Do not swap in a platform-detected glyph (Cmd/Ctrl): navigator-based
// detection differs between server and client and breaks SSR hydration.
function HeaderSearchButton() {
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  return (
    <Button
      variant="ghost"
      aria-label={m.layout_header_search()}
      onClick={openPalette}
      className="text-muted-foreground gap-1.5 max-xl:w-(--control-h) max-xl:px-0"
    >
      <SearchIcon className="size-4" />
      <span className="hidden xl:inline">{m.layout_header_search()}</span>
      <Kbd className="hidden xl:inline-flex">Ctrl K</Kbd>
    </Button>
  );
}

export function Header() {
  const { data: session, isPending } = useSession();
  const glossaryEnabled = useFeatureEnabled("glossary");
  const boardStatesEnabled = useFeatureEnabled("board-states");
  const scannerEnabled = useFeatureEnabled("scanner");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<LockedFeatureKey | null>(null);
  const navFlags: NavFlags = {
    glossary: glossaryEnabled,
    "board-states": boardStatesEnabled,
    scanner: scannerEnabled,
  };
  const isLoggedIn = Boolean(session?.user);
  const { data: badges } = useBadges();
  const loansBadge = badges?.loans.total ?? 0;
  const groupsBadge = badges?.groupRequests.count ?? 0;
  const tradesBadge = badges?.trades.people ?? 0;
  const navBadges: NavBadgeCounts = { groups: groupsBadge, trades: tradesBadge, loans: loansBadge };

  return (
    <header
      data-app-header
      className={cn(
        STICKY_SURFACE,
        "border-border-accent sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className={cn(CONTAINER_WIDTH, "px-safe grid h-14 grid-cols-[1fr_auto] items-center")}>
        {/* Left: Hamburger and logo on mobile. -ml-1 pulls the 20px glyph out
            of the 28px icon button's padding so it lands on the px-safe gutter,
            flush with page content below (cards, titles). */}
        <div className="-ml-1 flex items-center gap-1 md:hidden">
          <MenuButton
            onClick={() => setMobileMenuOpen(true)}
            badgeCount={navBadgeTotal(navBadges)}
          />
          <LogoLink />
        </div>

        <div className="hidden gap-4 md:flex">
          <LogoLink />
          <DesktopNav
            isLoggedIn={isLoggedIn}
            flags={navFlags}
            badges={navBadges}
            onLockedClick={setLockedFeature}
          />
        </div>

        {/* Right: Search + Help + Contribute + User menu. -mr-0.5 pulls the
            trailing avatar (24px in a 28px icon button) out to the px-safe
            gutter so the header's right edge aligns with flush page content. */}
        <div className="-mr-0.5 flex items-center gap-1 justify-self-end">
          <HeaderSearchButton />
          <HelpPopover />
          <ContributePopover isLoggedIn={isLoggedIn} onLockedClick={setLockedFeature} />
          <UserMenu session={session} isPending={isPending} onLockedClick={setLockedFeature} />
        </div>
      </div>

      <MobileNav
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        isLoggedIn={isLoggedIn}
        flags={navFlags}
        badges={navBadges}
        onLockedClick={setLockedFeature}
      />

      <SignInRequiredDialog
        featureKey={lockedFeature}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen) {
            setLockedFeature(null);
          }
        }}
      />
    </header>
  );
}
