import type { LockedFeatureKey } from "@/lib/nav-items";
import { lockedFeatures } from "@/lib/nav-items";

export interface AuthDestination {
  label: string;
  title: string;
  perks: string[];
}

function excluded(key: LockedFeatureKey, sub: string[]): boolean {
  const [second, ...rest] = sub;
  switch (key) {
    case "collections":
    case "tierLists": {
      return second === "share";
    }
    case "groups": {
      return second === "join";
    }
    case "tournaments": {
      return !(second === undefined || (second === "new" && rest.length === 0));
    }
    default: {
      return false;
    }
  }
}

export function authDestinationKey(redirect?: string): LockedFeatureKey | undefined {
  const path = redirect?.split(/[?#]/u, 1)[0] ?? "";
  const [first, ...sub] = path.split("/").filter(Boolean);
  if (first === undefined) {
    return undefined;
  }
  const features = lockedFeatures();
  const key = (Object.keys(features) as LockedFeatureKey[]).find(
    (candidate) => features[candidate].to === `/${first}`,
  );
  return key === undefined || excluded(key, sub) ? undefined : key;
}

export function authDestination(redirect?: string): AuthDestination | undefined {
  const key = authDestinationKey(redirect);
  if (key === undefined) {
    return undefined;
  }
  const feature = lockedFeatures()[key];
  return { label: feature.label, title: feature.signInTitle, perks: feature.signInPerks };
}
