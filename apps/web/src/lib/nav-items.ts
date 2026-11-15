import {
  CameraIcon,
  HandHeartIcon,
  HandshakeIcon,
  LibraryIcon,
  ListOrderedIcon,
  PencilLineIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

export type LockedFeatureKey =
  | "collections"
  | "scan"
  | "groups"
  | "trades"
  | "loans"
  | "tournaments"
  | "tierLists"
  | "contribute";

export interface LockedFeature {
  label: string;
  to: string;
  icon: LucideIcon;
  lockedDescription: string;
  signInTitle: string;
  signInPerks: string[];
}

export function lockedFeatures(): Record<LockedFeatureKey, LockedFeature> {
  return {
    collections: {
      label: m.nav_collection(),
      to: "/collections",
      icon: LibraryIcon,
      lockedDescription: m.nav_locked_collections_description(),
      signInTitle: m.auth_destination_collections_title(),
      signInPerks: [
        m.auth_destination_collections_perk_copies(),
        m.auth_destination_collections_perk_lists(),
        m.auth_destination_collections_perk_scan(),
      ],
    },
    scan: {
      label: m.nav_scan_full(),
      to: "/scan",
      icon: CameraIcon,
      lockedDescription: m.nav_locked_scan_description(),
      signInTitle: m.auth_destination_scan_title(),
      signInPerks: [
        m.auth_destination_scan_perk_add(),
        m.auth_destination_scan_perk_device(),
        m.auth_destination_scan_perk_owned(),
      ],
    },
    groups: {
      label: m.nav_groups(),
      to: "/groups",
      icon: UsersIcon,
      lockedDescription: m.nav_locked_groups_description(),
      signInTitle: m.auth_destination_groups_title(),
      signInPerks: [
        m.auth_destination_groups_perk_invite(),
        m.auth_destination_groups_perk_share(),
        m.auth_destination_groups_perk_matches(),
      ],
    },
    trades: {
      label: m.nav_trades(),
      to: "/trades",
      icon: HandshakeIcon,
      lockedDescription: m.nav_locked_trades_description(),
      signInTitle: m.auth_destination_trades_title(),
      signInPerks: [
        m.auth_destination_trades_perk_groups(),
        m.auth_destination_trades_perk_matches(),
        m.auth_destination_trades_perk_requests(),
      ],
    },
    loans: {
      label: m.nav_lending(),
      to: "/loans",
      icon: HandHeartIcon,
      lockedDescription: m.nav_locked_loans_description(),
      signInTitle: m.auth_destination_loans_title(),
      signInPerks: [
        m.auth_destination_loans_perk_lent(),
        m.auth_destination_loans_perk_returned(),
        m.auth_destination_loans_perk_borrowed(),
      ],
    },
    tournaments: {
      label: m.nav_tournaments(),
      to: "/tournaments",
      icon: TrophyIcon,
      lockedDescription: m.nav_locked_tournaments_description(),
      signInTitle: m.auth_destination_tournaments_title(),
      signInPerks: [
        m.auth_destination_tournaments_perk_pairings(),
        m.auth_destination_tournaments_perk_decklists(),
        m.auth_destination_tournaments_perk_judges(),
      ],
    },
    tierLists: {
      label: m.nav_tier_lists(),
      to: "/tier-lists",
      icon: ListOrderedIcon,
      lockedDescription: m.nav_locked_tier_lists_description(),
      signInTitle: m.auth_destination_tier_lists_title(),
      signInPerks: [
        m.auth_destination_tier_lists_perk_rank(),
        m.auth_destination_tier_lists_perk_save(),
        m.auth_destination_tier_lists_perk_share(),
      ],
    },
    contribute: {
      label: m.nav_contribute(),
      to: "/contribute",
      icon: PencilLineIcon,
      lockedDescription: m.nav_locked_contribute_description(),
      signInTitle: m.auth_destination_contribute_title(),
      signInPerks: [
        m.auth_destination_contribute_perk_cards(),
        m.auth_destination_contribute_perk_fixes(),
        m.auth_destination_contribute_perk_review(),
      ],
    },
  };
}

export interface NavBadgeCounts {
  groups: number;
  trades: number;
  loans: number;
}

export interface NavItemConfig {
  label: string;
  to: string;
  icon: LucideIcon;
  description?: string;
  keepSearch?: boolean;
  lockedKey?: LockedFeatureKey;
  badge?: keyof NavBadgeCounts;
  promoteWhenBadged?: boolean;
  flag?: "glossary" | "board-states" | "scanner";
  platform?: "mobile" | "desktop";
}
