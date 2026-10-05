import { sanitizeRedirect } from "@/lib/utils";

interface AuthSearch {
  redirect: string | undefined;
  email: string | undefined;
}

export function authSearchSchema(search: Record<string, unknown>): AuthSearch {
  const { redirect, email } = search;
  return {
    redirect: sanitizeRedirect(typeof redirect === "string" ? redirect : undefined),
    email: typeof email === "string" && email !== "" ? email : undefined,
  };
}

export function roundSearchSchema(search: Record<string, unknown>): { round?: number } {
  const round = Number(search.round);
  return Number.isInteger(round) && round > 0 ? { round } : {};
}
