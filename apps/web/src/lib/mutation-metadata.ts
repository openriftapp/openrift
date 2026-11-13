interface MutationTag<T> {
  tag: (value: T) => Record<string, unknown>;
  read: (metadata: unknown) => T | undefined;
}

export function mutationTag<T>(): MutationTag<T> {
  const values = new WeakMap<object, T>();
  return {
    tag: (value) => {
      const metadata = {};
      values.set(metadata, value);
      return metadata;
    },
    read: (metadata) =>
      typeof metadata === "object" && metadata !== null ? values.get(metadata) : undefined,
  };
}
