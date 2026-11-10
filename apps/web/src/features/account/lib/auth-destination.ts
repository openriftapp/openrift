import type { LockedFeatureKey } from "@/lib/nav-items";
import { m } from "@/paraglide/messages.js";

export interface AuthDestination {
  label: string;
  title: string;
  perks: string[];
}

export function authDestinationKey(redirect?: string): LockedFeatureKey | undefined {
  const path = redirect?.split(/[?#]/u, 1)[0] ?? "";
  const [first, second, ...rest] = path.split("/").filter(Boolean);
  switch (first) {
    case "collections": {
      return second === "share" ? undefined : "collections";
    }
    case "scan": {
      return "scan";
    }
    case "groups": {
      return second === "join" ? undefined : "groups";
    }
    case "trades": {
      return "trades";
    }
    case "loans": {
      return "loans";
    }
    case "tournaments": {
      return second === undefined || (second === "new" && rest.length === 0)
        ? "tournaments"
        : undefined;
    }
    case "tier-lists": {
      return second === "share" ? undefined : "tierLists";
    }
    case "contribute": {
      return "contribute";
    }
    default: {
      return undefined;
    }
  }
}

function destinations(): Record<LockedFeatureKey, AuthDestination> {
  return {
    collections: {
      label: m.nav_collection(),
      title: m.auth_destination_collections_title(),
      perks: [
        m.auth_destination_collections_perk_copies(),
        m.auth_destination_collections_perk_lists(),
        m.auth_destination_collections_perk_scan(),
      ],
    },
    scan: {
      label: m.nav_scan_full(),
      title: m.auth_destination_scan_title(),
      perks: [
        m.auth_destination_scan_perk_add(),
        m.auth_destination_scan_perk_device(),
        m.auth_destination_scan_perk_owned(),
      ],
    },
    groups: {
      label: m.nav_groups(),
      title: m.auth_destination_groups_title(),
      perks: [
        m.auth_destination_groups_perk_invite(),
        m.auth_destination_groups_perk_share(),
        m.auth_destination_groups_perk_matches(),
      ],
    },
    trades: {
      label: m.nav_trades(),
      title: m.auth_destination_trades_title(),
      perks: [
        m.auth_destination_trades_perk_groups(),
        m.auth_destination_trades_perk_matches(),
        m.auth_destination_trades_perk_requests(),
      ],
    },
    loans: {
      label: m.nav_lending(),
      title: m.auth_destination_loans_title(),
      perks: [
        m.auth_destination_loans_perk_lent(),
        m.auth_destination_loans_perk_returned(),
        m.auth_destination_loans_perk_borrowed(),
      ],
    },
    tournaments: {
      label: m.nav_tournaments(),
      title: m.auth_destination_tournaments_title(),
      perks: [
        m.auth_destination_tournaments_perk_pairings(),
        m.auth_destination_tournaments_perk_decklists(),
        m.auth_destination_tournaments_perk_judges(),
      ],
    },
    tierLists: {
      label: m.nav_tier_lists(),
      title: m.auth_destination_tier_lists_title(),
      perks: [
        m.auth_destination_tier_lists_perk_rank(),
        m.auth_destination_tier_lists_perk_save(),
        m.auth_destination_tier_lists_perk_share(),
      ],
    },
    contribute: {
      label: m.nav_contribute(),
      title: m.auth_destination_contribute_title(),
      perks: [
        m.auth_destination_contribute_perk_cards(),
        m.auth_destination_contribute_perk_fixes(),
        m.auth_destination_contribute_perk_review(),
      ],
    },
  };
}

export function authDestination(redirect?: string): AuthDestination | undefined {
  const key = authDestinationKey(redirect);
  return key ? destinations()[key] : undefined;
}
