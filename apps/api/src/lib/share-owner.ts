import { gravatarHashForEmail } from "./gravatar.js";

export interface ShareOwner<THash extends string | null = string> {
  displayName: string | null;
  gravatarHash: THash;
}

export function bylineName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

export function toShareOwner(owner: { displayName: string | null; email: string }): ShareOwner;
export function toShareOwner(owner: {
  displayName: string | null;
  email: string | null;
}): ShareOwner<string | null>;
export function toShareOwner(owner: {
  displayName: string | null;
  email: string | null;
}): ShareOwner<string | null> {
  return {
    displayName: bylineName(owner.displayName) ?? null,
    gravatarHash: owner.email ? gravatarHashForEmail(owner.email) : null,
  };
}
