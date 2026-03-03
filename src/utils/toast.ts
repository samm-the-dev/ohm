import type { CSSProperties } from 'react';
import { createElement } from 'react';
import { toast } from 'sonner';
import { Zap, Trash2, PackageCheck, Link, Cloud, CloudAlert } from 'lucide-react';
import type { ColumnStatus, OhmCard } from '../types/board';
import { STATUS, COLUMNS, SPARK_HEX } from '../types/board';

const zapIcon = createElement(Zap, { size: 14 });
const trashIcon = createElement(Trash2, { size: 14 });
const packageIcon = createElement(PackageCheck, { size: 14 });
const linkIcon = createElement(Link, { size: 14 });
const cloudIcon = createElement(Cloud, { size: 14 });
const cloudAlertIcon = createElement(CloudAlert, { size: 14 });

function accentStyle(hex: string = SPARK_HEX): CSSProperties {
  return { borderLeft: `3px solid ${hex}`, '--ohm-accent': hex } as CSSProperties;
}

export function toastCardMoved(card: OhmCard, destinationStatus: ColumnStatus) {
  const col = COLUMNS[destinationStatus]!;
  const isPowered = destinationStatus === STATUS.POWERED;
  toast(col.label, {
    description: card.title,
    duration: 2000,
    style: accentStyle(col.hex),
    className: isPowered ? 'ohm-toast-powered' : undefined,
    icon: zapIcon,
  });
}

export function toastCardDeleted(card: OhmCard, onUndo: () => void) {
  const col = COLUMNS[STATUS.LIVE]!;
  toast('Deleted', {
    description: card.title,
    duration: 5000,
    action: { label: 'Undo', onClick: onUndo },
    style: accentStyle(col.hex),
    icon: trashIcon,
  });
}

export function toastQuickAdd(title: string) {
  const col = COLUMNS[STATUS.CHARGING]!;
  toast('Charging', {
    description: title,
    duration: 2000,
    style: accentStyle(col.hex),
    icon: zapIcon,
  });
}

export function toastImportComplete(cardCount: number) {
  toast('Imported', {
    description: `${cardCount} card${cardCount !== 1 ? 's' : ''}`,
    duration: 3000,
    style: accentStyle(),
    icon: packageIcon,
  });
}

export function toastLinkCopied() {
  toast('Link copied', {
    duration: 2000,
    style: accentStyle(),
    icon: linkIcon,
  });
}

export function toastSyncResult(success: boolean) {
  const col = success ? COLUMNS[STATUS.POWERED]! : COLUMNS[STATUS.LIVE]!;
  toast(success ? 'Synced to Drive' : 'Drive sync failed', {
    duration: 2000,
    style: accentStyle(col.hex),
    icon: success ? cloudIcon : cloudAlertIcon,
  });
}
