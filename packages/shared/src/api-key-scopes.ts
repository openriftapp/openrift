// Scopes are stored in better-auth's `api_keys.permissions` column as JSON
// `Record<area, actions[]>`, e.g. `{"collection":["read","write"],"admin":["access"]}`.

export const API_KEY_AREAS = ["collection", "lists", "decks"] as const;
export type ApiKeyArea = (typeof API_KEY_AREAS)[number];

export type ApiKeyAccess = "read" | "write";
export type ApiKeyScope = `${ApiKeyArea}:${ApiKeyAccess}`;

export type ApiKeyPermissions = Partial<Record<ApiKeyArea, ApiKeyAccess[]>> & {
  admin?: ["access"];
};

export type ApiKeyAreaGrant = ApiKeyAccess | "none";

export const MAX_API_KEYS_PER_USER = 10;

export const API_KEY_EXPIRY_DAYS = [30, 90, 365] as const;
export type ApiKeyExpiryDays = (typeof API_KEY_EXPIRY_DAYS)[number];

export function apiKeyPermissionsFromGrants(
  grants: Partial<Record<ApiKeyArea, ApiKeyAreaGrant>>,
  admin: boolean,
): ApiKeyPermissions {
  const permissions: ApiKeyPermissions = {};
  for (const area of API_KEY_AREAS) {
    const grant = grants[area] ?? "none";
    if (grant === "read") {
      permissions[area] = ["read"];
    } else if (grant === "write") {
      permissions[area] = ["read", "write"];
    }
  }
  if (admin) {
    permissions.admin = ["access"];
  }
  return permissions;
}

export function parseApiKeyPermissions(raw: string | null | undefined): ApiKeyPermissions {
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }
  const record = parsed as Record<string, unknown>;
  const permissions: ApiKeyPermissions = {};
  for (const area of API_KEY_AREAS) {
    const actions = record[area];
    if (Array.isArray(actions)) {
      permissions[area] = actions.filter(
        (action): action is ApiKeyAccess => action === "read" || action === "write",
      );
    }
  }
  const admin = record.admin;
  if (Array.isArray(admin) && admin.includes("access")) {
    permissions.admin = ["access"];
  }
  return permissions;
}

export function isApiKeyScope(value: unknown): value is ApiKeyScope {
  if (typeof value !== "string") {
    return false;
  }
  const [area, access, ...rest] = value.split(":");
  return (
    rest.length === 0 &&
    (API_KEY_AREAS as readonly string[]).includes(area ?? "") &&
    (access === "read" || access === "write")
  );
}

export function apiKeyHoldsScope(permissions: ApiKeyPermissions, scope: ApiKeyScope): boolean {
  const [area, access] = scope.split(":") as [ApiKeyArea, ApiKeyAccess];
  return permissions[area]?.includes(access) ?? false;
}

export function apiKeyGrantFor(permissions: ApiKeyPermissions, area: ApiKeyArea): ApiKeyAreaGrant {
  const actions = permissions[area] ?? [];
  if (actions.includes("write")) {
    return "write";
  }
  return actions.includes("read") ? "read" : "none";
}
