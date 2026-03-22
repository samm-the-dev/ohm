import {
  createStorageService,
  type StorageService,
  type StorageAdapterType,
} from '../../.toolbox/lib/storage-service';

export type { StorageService, StorageAdapterType };

/** Shared StorageService instance — scoped to 'ohm' prefix. */
export const storageService: Promise<StorageService> = createStorageService({
  prefix: 'ohm',
  logPrefix: '[Ohm]',
}).then((s) => {
  if (import.meta.env.DEV) {
    console.log(`[Ohm] StorageService adapter: ${s.adapter}`);
  }
  return s;
});
