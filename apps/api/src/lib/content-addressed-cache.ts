export interface Versioned<T> {
  version: string;
  value: T;
}

export type VersionProbe = () => Promise<string>;

/**
 * Returns the version probed before the load, so a concurrent write can only make the value newer than it.
 * A caller holding its own connection passes `probe` to read the version there; concurrent default probes share one query.
 */
export function createVersionedCache<T>(
  load: () => Promise<T>,
  getVersion: VersionProbe,
): (probe?: VersionProbe) => Promise<Versioned<T>> {
  let cached: { version: string; value: Promise<T> } | null = null;
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

  return async (probe = probeVersion) => {
    let version: string;
    try {
      version = await probe();
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
  getVersion: VersionProbe,
): (probe?: VersionProbe) => Promise<T> {
  const get = createVersionedCache(load, getVersion);
  return async (probe) => {
    const { value } = await get(probe);
    return value;
  };
}
