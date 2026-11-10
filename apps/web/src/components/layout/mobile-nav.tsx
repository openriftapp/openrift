import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { UnreadDot } from "@/components/layout/help-menu";
import { NavCountBadge } from "@/components/layout/nav-count-badge";
import type { HeaderLinkConfig, NavFlags } from "@/components/layout/nav-items";
import {
  badgeAriaLabel,
  contributeLinks,
  helpLinks,
  keepsSearch,
  visibleMoreSections,
  visiblePrimaryItems,
} from "@/components/layout/nav-items";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useHelpMenuFlags } from "@/hooks/use-help-menu-flags";
import type { LockedFeatureKey, NavBadgeCounts, NavItemConfig } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Same active-state treatment as DESKTOP_NAV_ITEM_CLASS: background for
// hover only, text emphasis for the active route.
const MOBILE_NAV_ITEM_CLASS =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2.5 text-base data-[status=active]:font-semibold data-[status=active]:text-foreground";

const MOBILE_NAV_CELL_CLASS =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 text-left text-sm leading-tight data-[status=active]:font-semibold data-[status=active]:text-foreground";

function MobileNavItem({
  item,
  cell,
  isLoggedIn,
  badges,
  onLockedClick,
}: {
  item: NavItemConfig;
  cell?: boolean;
  isLoggedIn: boolean;
  badges: NavBadgeCounts;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const lockedKey = item.lockedKey;
  const keepSearch = useLocation({ select: (location) => keepsSearch(item, location.pathname) });
  const rowClass = cell ? MOBILE_NAV_CELL_CLASS : MOBILE_NAV_ITEM_CLASS;
  const icon = (
    <item.icon className={cn("text-muted-foreground shrink-0", cell ? "size-4" : "size-5")} />
  );
  if (lockedKey && !isLoggedIn) {
    return (
      <SheetClose
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bare render slot; SheetClose/MOBILE_NAV_ITEM_CLASS owns all styling and provides the label as children
        render={<button type="button" onClick={() => onLockedClick(lockedKey)} />}
        className={rowClass}
      >
        {icon}
        {item.label}
      </SheetClose>
    );
  }
  const badgeCount = item.badge ? badges[item.badge] : 0;
  return (
    <SheetClose
      nativeButton={false}
      render={<Link to={item.to} search={keepSearch ? (prev) => prev : undefined} />}
      className={rowClass}
    >
      {icon}
      {item.label}
      {item.badge && badgeCount > 0 && (
        <NavCountBadge
          count={badgeCount}
          label={badgeAriaLabel(item.badge, badgeCount)}
          className="ml-auto"
        />
      )}
    </SheetClose>
  );
}

function MobileSectionShell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mt-2", className)}>
      <SectionHeading as="h3" className="px-3 pb-1">
        {label}
      </SectionHeading>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </section>
  );
}

function MobileNavSection({
  section,
  isLoggedIn,
  badges,
  onLockedClick,
}: {
  section: { label: string; items: NavItemConfig[] };
  isLoggedIn: boolean;
  badges: NavBadgeCounts;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  return (
    <MobileSectionShell label={section.label}>
      {section.items.map((item) => (
        <MobileNavItem
          key={item.to}
          item={item}
          cell
          isLoggedIn={isLoggedIn}
          badges={badges}
          onLockedClick={onLockedClick}
        />
      ))}
    </MobileSectionShell>
  );
}

function MobileLinkCell({
  link,
  isLoggedIn,
  unread,
  onLockedClick,
}: {
  link: HeaderLinkConfig;
  isLoggedIn: boolean;
  unread: boolean;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const lockedKey = link.lockedKey;
  const content = (
    <>
      <link.icon className="text-muted-foreground size-4 shrink-0" />
      {link.label}
      {link.unreadDot && unread && <UnreadDot />}
    </>
  );
  if (lockedKey && !isLoggedIn) {
    return (
      <SheetClose
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bare render slot; SheetClose/MOBILE_NAV_CELL_CLASS owns all styling and provides the label as children
        render={<button type="button" onClick={() => onLockedClick(lockedKey)} />}
        className={MOBILE_NAV_CELL_CLASS}
      >
        {content}
      </SheetClose>
    );
  }
  return (
    <SheetClose
      nativeButton={false}
      render={
        link.href === undefined ? (
          <Link to={link.to} />
        ) : (
          // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- content is provided as children of SheetClose
          <a href={link.href} target="_blank" rel="noreferrer" />
        )
      }
      className={MOBILE_NAV_CELL_CLASS}
    >
      {content}
    </SheetClose>
  );
}

export function MobileNav({
  open,
  onOpenChange,
  isLoggedIn,
  flags,
  badges,
  onLockedClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoggedIn: boolean;
  flags: NavFlags;
  badges: NavBadgeCounts;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  const { showInstall, hasNewMilestone } = useHelpMenuFlags();
  const linkSections = [
    {
      id: "help",
      label: m.layout_header_help(),
      links: helpLinks({ showInstall, installLast: true }),
    },
    { id: "contribute", label: m.layout_header_contribute(), links: contributeLinks() },
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>
            <Link
              to="/cards"
              className="font-heading flex items-center gap-2 font-bold"
              onClick={() => onOpenChange(false)}
            >
              <img src="/logo-color.svg" alt="OpenRift" className="size-6" />
              OpenRift
            </Link>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {visiblePrimaryItems({ flags, mobile: true, badges }).map((item) => (
            <MobileNavItem
              key={item.to}
              item={item}
              isLoggedIn={isLoggedIn}
              badges={badges}
              onLockedClick={onLockedClick}
            />
          ))}
          {visibleMoreSections({ flags, mobile: true, badges }).map((section) => (
            <MobileNavSection
              key={section.id}
              section={section}
              isLoggedIn={isLoggedIn}
              badges={badges}
              onLockedClick={onLockedClick}
            />
          ))}
          {linkSections.map((section, index) => (
            <MobileSectionShell
              key={section.id}
              label={section.label}
              className={cn(index === 0 && "border-border mt-auto border-t pt-3")}
            >
              {section.links.map((link) => (
                <MobileLinkCell
                  key={link.id}
                  link={link}
                  isLoggedIn={isLoggedIn}
                  unread={hasNewMilestone}
                  onLockedClick={onLockedClick}
                />
              ))}
            </MobileSectionShell>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
