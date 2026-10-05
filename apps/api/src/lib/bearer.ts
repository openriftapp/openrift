export function bearerToken(header: string | undefined | null): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token === "" ? null : token;
}
