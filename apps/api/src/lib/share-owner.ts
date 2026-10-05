import { gravatarHashForEmail } from "./gravatar.js";

export interface ShareOwner<THash extends string | null = string> {
  displayName: string;
  gravatarHash: THash;
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
    displayName: owner.displayName ?? "Anonymous",
    gravatarHash: owner.email ? gravatarHashForEmail(owner.email) : null,
  };
}
