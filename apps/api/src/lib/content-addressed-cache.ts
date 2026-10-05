/**
 * The cache entry must be set synchronously, with no `await` between the
 * version check and the assignment, or concurrent callers would each trigger their own assembly.
 */
export function createContentAddressedCache<T>(
  load: () => Promise<T>,
  getVersion: () => Promise<string>,
): () => Promise<T> {
  let cached: { version: string; value: Promise<T> } | null = null;
  // A getVersion() that never settles pins this for every later caller, as a hung postgres.js
  // query did (porsager/postgres#1208). See docs/deployment.md "Known issues".
  let inflightProbe: Promise<string> | null = null;

  const probeVersion = async (): Promise<string> => {
    inflightProbe ??= getVersion();
    const probe = inflightProbe;
    try {
      return await probe;
    } finally {
      if (inflightProbe === probe) {
        inflightProbe = null;
      }
    }
  };

  return async () => {
    let version: string;
    try {
      version = await probeVersion();
    } catch (error) {
      // A transient probe failure must not break reads: serve the last good
      // catalog if we have one, else surface the error.
      if (cached) {
        return cached.value;
      }
      throw error;
    }
    if (cached && cached.version === version) {
      return cached.value;
    }
    const entry = { version, value: load() };
    // Fire-and-forget: awaiting here would defeat sharing the in-flight promise with concurrent callers.
    // oxlint-disable-next-line promise/prefer-await-to-then -- side-channel cleanup, must not await
    entry.value.catch(() => {
      if (cached === entry) {
        cached = null;
      }
    });
    cached = entry;
    return entry.value;
  };
}
