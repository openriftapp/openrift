export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDatabase(connectionString: string): boolean {
  return LOCAL_HOSTS.has(new URL(connectionString).hostname);
}

export function assertLocalDatabase(connectionString: string): void {
  if (!isLocalDatabase(connectionString)) {
    const host = new URL(connectionString).hostname;
    throw new Error(
      `Refusing to run against a non-local database (host: ${host}). This script is for local dev only.`,
    );
  }
}
