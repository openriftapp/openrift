export async function sha256Hex(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** `?d=404` makes a missing avatar surface as an `error` status the Avatar component falls through on. */
export function gravatarUrlFromHash(hash: string, size = 80): string {
  return `https://gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
