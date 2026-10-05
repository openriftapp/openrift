import { useLocation } from "@tanstack/react-router";

export function useSignInSearch() {
  const href = useLocation({ select: (location) => location.href });
  return {
    to: "/login" as const,
    search: { redirect: href || undefined, email: undefined },
  };
}
