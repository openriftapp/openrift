import { RESERVED_FRIEND_GROUP_SLUGS } from "@openrift/shared/contracts/friend-groups";
import { slugifyName } from "@openrift/shared/utils";

import { m } from "@/paraglide/messages.js";

const MIN_LENGTH = 3;
const MAX_LENGTH = 30;

export function deriveGroupSlug(name: string): string {
  return slugifyName(name).slice(0, MAX_LENGTH).replace(/-+$/u, "");
}

export function groupSlugError(slug: string): string | null {
  if (slug.length === 0) {
    return null;
  }
  if (slug.length < MIN_LENGTH) {
    return m.groups_slug_error_min({ count: MIN_LENGTH });
  }
  if (slug.length > MAX_LENGTH) {
    return m.groups_slug_error_max({ count: MAX_LENGTH });
  }
  if (!/^[a-z0-9][a-z0-9-]+$/u.test(slug)) {
    return m.groups_slug_error_pattern();
  }
  if (RESERVED_FRIEND_GROUP_SLUGS.has(slug)) {
    return m.groups_slug_error_reserved();
  }
  return null;
}
