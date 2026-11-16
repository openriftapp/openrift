const SECRET_FIELDS: ReadonlySet<string> = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "confirmpassword",
]);

const FORM_FIELDS: ReadonlySet<string> = new Set([...SECRET_FIELDS, "email", "name"]);

const LOCAL_BASE = "http://local";

const MAX_DECODE_ROUNDS = 3;

function decodedRedirect(value: string): string {
  let current = value;
  for (let round = 0; round < MAX_DECODE_ROUNDS && !current.includes("?"); round++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return current;
    }
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
}

function fieldName(key: string): string {
  return key.toLowerCase().replace(/(?:\[[^\]]*\])+$/u, "");
}

// Backslashes are rejected too: some browsers normalize "\" to "/", which
// would turn "/\evil.com" into a protocol-relative URL.
export function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

/**
 * A query carrying a secret came from a native form submit and loses every form field, also
 * inside a nested `redirect` target. Any other path comes back unchanged.
 */
export function withoutSubmittedFields(href: string): string {
  if (!href.includes("?")) {
    return href;
  }
  const url = new URL(href, LOCAL_BASE);
  const entries = [...url.searchParams];
  const secret = entries.some(([key]) => SECRET_FIELDS.has(fieldName(key)));
  let changed = secret;
  const kept = entries.flatMap(([key, value]): [string, string][] => {
    if (secret && FORM_FIELDS.has(fieldName(key))) {
      return [];
    }
    if (key !== "redirect") {
      return [[key, value]];
    }
    const decoded = decodedRedirect(value);
    const cleaned = withoutSubmittedFields(decoded);
    if (cleaned === decoded) {
      return [[key, value]];
    }
    changed = true;
    return [[key, cleaned]];
  });
  if (!changed) {
    return href;
  }
  const path = isLocalPath(url.pathname) ? url.pathname : "/";
  const query = new URLSearchParams(kept).toString();
  return `${path}${query ? `?${query}` : ""}${url.hash}`;
}
