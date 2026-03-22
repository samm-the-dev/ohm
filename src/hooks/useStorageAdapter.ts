import { useState, useEffect } from 'react';
import type { StorageAdapterType } from '../utils/storage-service';
import { storageService } from '../utils/storage-service';

/** Returns which storage adapter resolved at init. */
export function useStorageAdapter(): StorageAdapterType | null {
  const [adapter, setAdapter] = useState<StorageAdapterType | null>(null);

  useEffect(() => {
    let mounted = true;
    storageService
      .then((s) => {
        if (mounted) setAdapter(s.adapter);
      })
      .catch(() => {
        if (mounted) setAdapter('localstorage');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return adapter;
}
