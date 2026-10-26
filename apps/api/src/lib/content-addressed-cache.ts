export interface Versioned<T> {
  version: string;
  value: T;
}

/** Returns the version probed before the load, so a concurrent write can only make the value newer than it. */
export function createVersionedCache<T>(
  load: () => Promise<T>,
  getVersion: () => Promise<string>,
): () => Promise<Versioned<T>> {
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

  const settle = async (entry: { version: string; value: Promise<T> }): Promise<Versioned<T>> => ({
    version: entry.version,
    value: await entry.value,
  });

  return async () => {
    let version: string;
    try {
      version = await probeVersion();
    } catch (error) {
      // A transient probe failure must not break reads: serve the last good
      // catalog if we have one, else surface the error.
      if (cached) {
        return settle(cached);
      }
      throw error;
    }
    if (cached && cached.version === version) {
      return settle(cached);
    }
    // The entry must be set synchronously, with no `await` between the version
    // check and the assignment, or concurrent callers would each trigger their own assembly.
    const entry = { version, value: load() };
    // Fire-and-forget: awaiting here would defeat sharing the in-flight promise with concurrent callers.
    // oxlint-disable-next-line promise/prefer-await-to-then -- side-channel cleanup, must not await
    entry.value.catch(() => {
      if (cached === entry) {
        cached = null;
      }
    });
    cached = entry;
    return settle(entry);
  };
}

export function createContentAddressedCache<T>(
  load: () => Promise<T>,
  getVersion: () => Promise<string>,
): () => Promise<T> {
  const get = createVersionedCache(load, getVersion);
  return async () => {
    const { value } = await get();
    return value;
  };
}
