/** Test stub for .toolbox/lib/storage-service */

export type StorageAdapterType = 'opfs' | 'localstorage';

export interface StorageService {
  readonly adapter: StorageAdapterType;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface StorageServiceOptions {
  prefix?: string;
  logPrefix?: string;
}

export async function createStorageService(_opts?: StorageServiceOptions): Promise<StorageService> {
  const store = new Map<string, string>();

  return {
    adapter: 'localstorage',
    async get<T>(key: string): Promise<T | null> {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return JSON.parse(raw) as T;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, JSON.stringify(value));
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async clear(): Promise<void> {
      store.clear();
    },
    async keys(): Promise<string[]> {
      return [...store.keys()];
    },
  };
}
