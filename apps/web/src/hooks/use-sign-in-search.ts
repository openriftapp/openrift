import { useLocation } from "@tanstack/react-router";

/** The server never sees the hash, so a redirect rendered into a link leaves it out. */
export function hrefWithoutHash(href: string): string {
  const hashAt = href.indexOf("#");
  return hashAt === -1 ? href : href.slice(0, hashAt);
}

export function useSignInSearch() {
  const href = useLocation({ select: (location) => hrefWithoutHash(location.href) });
  return {
    to: "/login" as const,
    search: { redirect: href || undefined, email: undefined },
  };
}
