import { Link } from "@tanstack/react-router";
import {
  BookOpenIcon,
  BookTextIcon,
  CameraIcon,
  GavelIcon,
  GiftIcon,
  HandHeartIcon,
  HandshakeIcon,
  LayersIcon,
  LibraryIcon,
  ListOrderedIcon,
  MonitorPlayIcon,
  PackageIcon,
  PackagePlusIcon,
  PaletteIcon,
  PencilLineIcon,
  SwordsIcon,
  TrendingUpIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LockedFeatureKey, NavBadgeCounts, NavItemConfig } from "@/lib/nav-items";
import { m } from "@/paraglide/messages.js";

function lockedFeatures(): Record<
  LockedFeatureKey,
  { title: string; description: string; to: string; icon: typeof LibraryIcon }
> {
  return {
    collections: {
      title: m.nav_collection(),
      description: m.nav_locked_collections_description(),
      to: "/collections",
      icon: LibraryIcon,
    },
    scan: {
      title: m.nav_scan_full(),
      description: m.nav_locked_scan_description(),
      to: "/scan",
      icon: CameraIcon,
    },
    groups: {
      title: m.nav_groups(),
      description: m.nav_locked_groups_description(),
      to: "/groups",
      icon: UsersIcon,
    },
    trades: {
      title: m.nav_trades(),
      description: m.nav_locked_trades_description(),
      to: "/trades",
      icon: HandshakeIcon,
    },
    loans: {
      title: m.nav_lending(),
      description: m.nav_locked_loans_description(),
      to: "/loans",
      icon: HandHeartIcon,
    },
    tournaments: {
      title: m.nav_tournaments(),
      description: m.nav_locked_tournaments_description(),
      to: "/tournaments",
      icon: TrophyIcon,
    },
    tierLists: {
      title: m.nav_tier_lists(),
      description: m.nav_locked_tier_lists_description(),
      to: "/tier-lists",
      icon: ListOrderedIcon,
    },
    contribute: {
      title: m.nav_contribute(),
      description: m.nav_locked_contribute_description(),
      to: "/contribute",
      icon: PencilLineIcon,
    },
  };
}

export interface NavSectionConfig {
  label: string;
  items: NavItemConfig[];
}

// Renders as the desktop top-level links and the mobile sheet's first block.
// moreNavSections below renders in the desktop "More" panel and as titled
// groups in the mobile sheet.
export function primaryNavItems(): NavItemConfig[] {
  return [
    { label: m.nav_cards(), to: "/cards", icon: LayersIcon, keepSearch: true },
    { label: m.nav_collection(), to: "/collections", icon: LibraryIcon, lockedKey: "collections" },
    { label: m.nav_scan(), to: "/scan", icon: CameraIcon, lockedKey: "scan", platform: "mobile" },
    // Decks are available logged out, so this entry is a plain link for everyone.
    { label: m.nav_decks(), to: "/decks", icon: BookOpenIcon },
    // Only here, not also under Explore: the mobile sheet renders both lists,
    // so an entry in each would show up twice.
    { label: m.nav_meta(), to: "/meta", icon: TrendingUpIcon, flag: "meta" },
    { label: m.nav_groups(), to: "/groups", icon: UsersIcon, lockedKey: "groups", badge: "groups" },
  ];
}

export function moreNavSections(): NavSectionConfig[] {
  return [
    {
      label: m.nav_section_play(),
      items: [
        {
          label: m.nav_rules(),
          to: "/rules",
          icon: GavelIcon,
          description: m.nav_rules_description(),
        },
        {
          label: m.nav_glossary(),
          to: "/glossary",
          icon: BookTextIcon,
          flag: "glossary",
          description: m.nav_glossary_description(),
        },
        {
          label: m.nav_match_tracker(),
          to: "/match-tracker",
          icon: SwordsIcon,
          description: m.nav_match_tracker_description(),
        },
      ],
    },
    {
      label: m.nav_section_organize(),
      items: [
        {
          label: m.nav_scan(),
          to: "/scan",
          icon: CameraIcon,
          lockedKey: "scan",
          platform: "desktop",
          description: m.nav_scan_description(),
        },
        {
          label: m.nav_tournaments(),
          to: "/tournaments",
          icon: TrophyIcon,
          lockedKey: "tournaments",
          description: m.nav_tournaments_description(),
        },
        {
          label: m.nav_trades(),
          to: "/trades",
          icon: HandshakeIcon,
          lockedKey: "trades",
          badge: "trades",
          description: m.nav_trades_description(),
        },
        {
          label: m.nav_lending(),
          to: "/loans",
          icon: HandHeartIcon,
          lockedKey: "loans",
          badge: "loans",
          description: m.nav_lending_description(),
        },
      ],
    },
    {
      label: m.nav_section_create(),
      items: [
        {
          label: m.nav_stage(),
          to: "/stage",
          icon: MonitorPlayIcon,
          platform: "desktop",
          description: m.nav_stage_description(),
        },
        {
          label: m.nav_tier_lists(),
          to: "/tier-lists",
          icon: ListOrderedIcon,
          lockedKey: "tierLists",
          platform: "desktop",
          description: m.nav_tier_lists_description(),
        },
      ],
    },
    {
      label: m.nav_section_explore(),
      items: [
        {
          label: m.nav_promos(),
          to: "/promos",
          icon: GiftIcon,
          description: m.nav_promos_description(),
        },
        {
          label: m.nav_products(),
          to: "/products",
          icon: PackageIcon,
          description: m.nav_products_description(),
        },
        {
          label: m.nav_pack_opener(),
          to: "/pack-opener",
          icon: PackagePlusIcon,
          description: m.nav_pack_opener_description(),
        },
        {
          label: m.nav_card_designer(),
          to: "/card-designer",
          icon: PaletteIcon,
          description: m.nav_card_designer_description(),
        },
      ],
    },
  ];
}

export type NavFlags = Record<NonNullable<NavItemConfig["flag"]>, boolean>;

export function navItemVisible(
  item: NavItemConfig,
  opts: { flags: NavFlags; mobile: boolean },
): boolean {
  if (item.flag !== undefined && !opts.flags[item.flag]) {
    return false;
  }
  if (item.platform === "mobile" && !opts.mobile) {
    return false;
  }
  if (item.platform === "desktop" && opts.mobile) {
    return false;
  }
  return true;
}

// Drops sections left with no visible items, so an all-desktop section
// leaves no empty heading behind in the mobile sheet.
export function visibleMoreSections(opts: {
  flags: NavFlags;
  mobile: boolean;
}): { label: string; items: NavItemConfig[] }[] {
  const sections = moreNavSections().map((section) => ({
    label: section.label,
    items: section.items.filter((item) => navItemVisible(item, opts)),
  }));
  return sections.filter((section) => section.items.length > 0);
}

export function badgeAriaLabel(badge: keyof NavBadgeCounts, count: number): string {
  if (badge === "loans") {
    return m.nav_badge_loans({ count });
  }
  if (badge === "trades") {
    return m.nav_badge_trades({ count });
  }
  return m.nav_badge_requests({ count });
}

export function SignInRequiredDialog({
  featureKey,
  onOpenChange,
}: {
  featureKey: LockedFeatureKey | null;
  onOpenChange: (open: boolean) => void;
}) {
  const feature = featureKey ? lockedFeatures()[featureKey] : null;
  return (
    <Dialog open={Boolean(feature)} onOpenChange={onOpenChange}>
      {feature && (
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <feature.icon className="text-primary size-5" />
              <DialogTitle>{feature.title}</DialogTitle>
            </div>
            <DialogDescription>{feature.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Link
              to="/login"
              search={{ redirect: feature.to, email: undefined }}
              className={buttonVariants({ variant: "ghost" })}
              onClick={() => onOpenChange(false)}
            >
              {m.common_sign_in()}
            </Link>
            <Link
              to="/signup"
              search={{ redirect: feature.to, email: undefined }}
              className={buttonVariants({ variant: "default" })}
              onClick={() => onOpenChange(false)}
            >
              {m.common_sign_up()}
            </Link>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
