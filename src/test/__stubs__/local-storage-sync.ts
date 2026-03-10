/** Test stub for .toolbox/lib/local-storage-sync */
export function createLocalStorage<T>(opts: {
  storageKey: string;
  logPrefix?: string;
  version?: number;
  sanitize?: (raw: unknown) => T;
  createDefault: () => T;
}) {
  return {
    loadFromLocal: (): T => {
      const raw = localStorage.getItem(opts.storageKey);
      if (!raw) return opts.createDefault();
      try {
        const parsed = JSON.parse(raw) as T;
        return opts.sanitize ? opts.sanitize(parsed) : parsed;
      } catch {
        return opts.createDefault();
      }
    },
    saveToLocal: (val: T) => {
      localStorage.setItem(opts.storageKey, JSON.stringify(val));
    },
  };
}
