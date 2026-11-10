import { Link } from "@tanstack/react-router";
import { CircleHelpIcon, ExternalLinkIcon, PencilLineIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { HeaderLinkConfig } from "@/components/layout/nav-items";
import { contributeLinks, helpLinks } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHelpMenuFlags } from "@/hooks/use-help-menu-flags";
import type { LockedFeatureKey } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="whats-new-unread-dot"
      className={cn("bg-primary size-2 shrink-0 rounded-full", className)}
    />
  );
}

const POPOVER_ROW_CLASS = "hover:bg-muted flex items-center gap-3 rounded-md px-2 py-2 text-sm";

function PopoverRowText({ label, description }: { label: string; description: string }) {
  return (
    <div>
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground text-xs">{description}</div>
    </div>
  );
}

function PopoverLinkRow({
  link,
  isLoggedIn,
  unread,
  onLockedClick,
}: {
  link: HeaderLinkConfig;
  isLoggedIn?: boolean;
  unread?: boolean;
  onLockedClick?: (key: LockedFeatureKey) => void;
}) {
  const lockedKey = link.lockedKey;
  const icon: ReactNode = link.unreadDot ? (
    <span className="relative shrink-0">
      <link.icon className="size-4" />
      {unread && <UnreadDot className="absolute -top-0.5 -right-0.5" />}
    </span>
  ) : (
    <link.icon className="size-4 shrink-0" />
  );
  const text = <PopoverRowText label={link.label} description={link.description} />;
  if (lockedKey && onLockedClick && !isLoggedIn) {
    return (
      <PopoverClose
        // A native <button> shrinks to its content and centers its text; force
        // it to fill and left-align so it matches the <Link>-rendered rows.
        className={cn(POPOVER_ROW_CLASS, "w-full text-left")}
        // oxlint-disable-next-line jsx-a11y/control-has-associated-label, react/forbid-elements -- bare render slot; PopoverClose owns all styling and provides the label as children
        render={<button type="button" onClick={() => onLockedClick(lockedKey)} />}
      >
        {icon}
        {text}
      </PopoverClose>
    );
  }
  if (link.href !== undefined) {
    return (
      <PopoverClose
        nativeButton={false}
        render={
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- content is provided as children of PopoverClose
          <a href={link.href} target="_blank" rel="noreferrer" />
        }
        className={POPOVER_ROW_CLASS}
      >
        {icon}
        {text}
        <ExternalLinkIcon className="text-muted-foreground ml-auto size-3.5" />
      </PopoverClose>
    );
  }
  return (
    <PopoverClose nativeButton={false} render={<Link to={link.to} />} className={POPOVER_ROW_CLASS}>
      {icon}
      {text}
    </PopoverClose>
  );
}

export function HelpPopover() {
  const { showInstall, hasNewMilestone } = useHelpMenuFlags();
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="sm" />}
        className="hidden gap-1.5 md:inline-flex"
      >
        <CircleHelpIcon className="size-4" />
        <span className="sr-only lg:not-sr-only">{m.layout_header_help()}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-1 p-1.5">
        <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs">
          {m.layout_header_help_intro()}
        </p>
        {helpLinks({ showInstall }).map((link) => (
          <PopoverLinkRow key={link.id} link={link} unread={hasNewMilestone} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ContributePopover({
  isLoggedIn,
  onLockedClick,
}: {
  isLoggedIn: boolean;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="sm" />}
        className="hidden gap-1.5 lg:inline-flex"
      >
        <PencilLineIcon className="size-4" />
        <span className="sr-only lg:not-sr-only">{m.layout_header_contribute()}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-1 p-1.5">
        <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs">
          {m.layout_header_contribute_intro()}
        </p>
        {contributeLinks().map((link) => (
          <PopoverLinkRow
            key={link.id}
            link={link}
            isLoggedIn={isLoggedIn}
            onLockedClick={onLockedClick}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

// The Contribute popover starts at lg and the phone sheet carries the links
// below md, so the account menu holds them only in between.
export function ContributeSubmenu({
  isLoggedIn,
  onLockedClick,
}: {
  isLoggedIn: boolean;
  onLockedClick: (key: LockedFeatureKey) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="hidden md:flex lg:hidden">
        <PencilLineIcon className="size-4" />
        {m.layout_header_contribute()}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {contributeLinks().map((link) => {
          const lockedKey = link.lockedKey;
          const icon = <link.icon className="size-4" />;
          if (lockedKey && !isLoggedIn) {
            return (
              <DropdownMenuItem key={link.id} onClick={() => onLockedClick(lockedKey)}>
                {icon}
                {link.label}
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={link.id}
              render={
                link.href === undefined ? (
                  <Link to={link.to} />
                ) : (
                  // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- content is provided as children of DropdownMenuItem
                  <a href={link.href} target="_blank" rel="noreferrer" />
                )
              }
            >
              {icon}
              {link.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
