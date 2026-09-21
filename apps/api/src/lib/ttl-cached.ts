export function ttlCached<T>(ttlMs: number, load: () => Promise<T>): () => Promise<T> {
  let cached: { value: T; expiresAt: number } | undefined;
  let inflight: Promise<T> | undefined;

  async function refresh(): Promise<T> {
    try {
      const value = await load();
      cached = { value, expiresAt: Date.now() + ttlMs };
      return value;
    } finally {
      inflight = undefined;
    }
  }

  return () => {
    if (cached !== undefined && Date.now() < cached.expiresAt) {
      return Promise.resolve(cached.value);
    }
    inflight ??= refresh();
    return inflight;
  };
}
