import { HardDrive } from 'lucide-react';
import type { StorageAdapterType } from '../utils/storage-service';

const ADAPTER_TOOLTIP: Record<StorageAdapterType, string> = {
  opfs: 'Your data is saved securely on this device',
  localstorage: 'Data may be cleared by your browser',
};

interface StorageIndicatorProps {
  adapter: StorageAdapterType | null;
}

export function StorageIndicator({ adapter }: StorageIndicatorProps) {
  if (adapter !== 'opfs') return null;

  const label = ADAPTER_TOOLTIP[adapter];

  return (
    <span className="text-ohm-muted rounded-md p-1.5" aria-label={label} title={label}>
      <HardDrive size={16} />
    </span>
  );
}
