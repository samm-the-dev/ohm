# StorageService Abstraction — Design Proposal

## Current State

### localStorage Keys & Data Shapes

| Key | Data Shape | Read/Write | Frequency | File |
|-----|-----------|------------|-----------|------|
| `ohm-board` | `OhmBoard` (JSON, ~5-50KB) | R+W | Read: mount. Write: debounced 500ms on every board change | `storage.ts` via `createLocalStorage` |
| `ohm-restore-points` | `RestorePoint[]` (up to 10 full board snapshots, ~50-500KB) | R+W | Read/Write: on sync operations, user actions | `restore-points.ts` direct |
| `ohm-last-opened` | `string` (Unix timestamp) | R+W | Once per session (mount) | `useWelcomeBack.ts` direct |
| `ohm-drive-synced` | `'1'` or absent | R+W+D | Read: mount. Write: connect/disconnect | `useDriveSync.ts` direct |
| `ohm-drive-*` | OAuth tokens (managed by toolbox) | R+W | On auth flows, silent refresh | `.toolbox/lib/google-drive-sync` internal |

### GDrive Sync Architecture

The sync layer (`useDriveSync` → `google-drive.ts` → `.toolbox/lib/google-drive-sync`) currently:

1. **Reads localStorage** indirectly — `loadFromLocal()` provides the current board for merge comparison
2. **Writes localStorage** indirectly — `replaceBoard()` calls `saveToLocal()` after merge
3. **Reads localStorage directly** — `ohm-drive-synced` flag for auto-reconnect
4. **Manages its own tokens** — `ohm-drive-*` keys handled internally by `createDriveSync`

Data flow on sync:
```
loadFromDrive() → mergeBoards(local, remote) → replaceBoard(merged) → saveToLocal(merged)
                                                                     → queueSync() → saveToDrive(merged)
```

The Drive layer never calls `localStorage` for board data directly — it always goes through `storage.ts` exports. The `ohm-drive-synced` flag and token keys are the only direct localStorage touches.

### Existing Patterns

- **Factory functions** in `.toolbox/lib/` (`createLocalStorage`, `createDriveSync`) — this is THE pattern to follow
- **Utils** = stateless exports (`src/utils/`), **Hooks** = React state + side effects (`src/hooks/`)
- **No service layer exists** — no classes, no DI container
- **Test stubs** via vitest aliases mapping `.toolbox/lib/*` → `src/test/__stubs__/*`
- **Config** in `src/config/` for environment-driven constants

---

## Migration Complications

### Synchronous Read Requirements
`loadFromLocal()` is called synchronously in `useBoard`'s initial state:
```ts
const [board, setBoard] = useState<OhmBoard>(() => loadFromLocal());
```
OPFS is async-only. This is the **single hardest migration point**. Options:
1. **Two-phase init**: `useState(createDefaultBoard)` → `useEffect` loads from OPFS → replaces state (causes a flash/re-render)
2. **Suspense boundary**: wrap board in `<Suspense>` with a loader, use `use()` or a data-fetching pattern
3. **Sync localStorage read as bootstrap, async OPFS as source of truth**: keep a synchronous localStorage cache that mirrors OPFS, read sync on mount, then async-validate against OPFS

Option 3 is recommended — it's the least disruptive to the current architecture and provides instant mount with OPFS as the durable backend.

### High-Frequency Writes
Board saves fire every 500ms during active editing. OPFS writes are async but fast (no serialization overhead beyond structured clone). The existing debounce is sufficient — no change needed.

### Large Payloads
Restore points store up to 10 full board snapshots. This is the largest payload (~500KB worst case). Well within OPFS limits but worth noting for the migration order — migrate `ohm-board` first, restore points second.

### Multi-Tab Coordination
OPFS (via `createSyncAccessHandle`) locks files to one tab. The app isn't designed for multi-tab, but we can handle it cheaply at the storage level:

- Use the **async** OPFS API (`FileSystemFileHandle.getFile()` / `createWritable()`), NOT `createSyncAccessHandle` — async API allows concurrent reads from multiple tabs, and writes don't require exclusive locks
- Add a lightweight **`BroadcastChannel`** listener so that when one tab writes, other tabs can invalidate their in-memory state (or at minimum not clobber the write on their next save)
- The localStorage mirror already gives us `storage` events cross-tab for free — `window.addEventListener('storage', ...)` fires in non-originating tabs. This is a natural coordination signal

This isn't building multi-tab support — it's preventing multi-tab corruption. Low effort, high safety.

### Token Storage
`ohm-drive-*` keys are managed internally by `.toolbox/lib/google-drive-sync`. These should **NOT** be migrated to OPFS — they're small, infrequently written, and the toolbox module owns them. Leave as localStorage.

---

## Proposal

### Location

```
src/utils/storage-service.ts    ← Interface + factory
src/utils/opfs-adapter.ts       ← OPFS adapter
src/utils/localstorage-adapter.ts ← localStorage adapter (fallback + sync cache)
src/test/__stubs__/storage-service.ts ← Test stub
```

This follows the existing pattern: utils export factory functions, no classes needed for the public API.

**Naming note:** "adapter" rather than "backend" — these are storage adapters that implement the StorageService interface. The app has one real backend (the user's browser); adapters are just the access strategy.

### Interface

```ts
/** Which storage adapter is active */
export type StorageAdapter = 'opfs' | 'localstorage';

/** Async key-value storage with typed values */
export interface StorageService {
  /** Which adapter resolved at init */
  readonly adapter: StorageAdapter;

  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/** Factory options */
export interface StorageServiceOptions {
  /** Prefix for all keys (e.g. 'ohm') — prevents collisions */
  prefix?: string;
  /** Called on read to validate/migrate data */
  sanitize?: <T>(key: string, raw: unknown) => T;
}

/** Create a StorageService — resolves OPFS when available, localStorage otherwise */
export function createStorageService(opts?: StorageServiceOptions): Promise<StorageService>;
```

**Design decisions:**
- **All async** — OPFS requires it, localStorage can trivially be wrapped in `Promise.resolve()`
- **Untyped keys with generic methods** — callers provide the type at call site, matching the flexibility of `localStorage.getItem`/`setItem`
- **Prefix option** — namespaces keys for multi-app toolbox extraction
- **No per-key config** — sanitization/defaults belong in the calling layer (e.g., `storage.ts` keeps `sanitizeBoard`)
- **`adapter` property** — exposes which adapter resolved, so the UI can show a storage status segment (see below)
- **Async factory** — `createStorageService()` returns a Promise because OPFS availability detection (`navigator.storage.getDirectory()`) is itself async

### Storage Status Segment

The app already has a `SyncIndicator` for Drive sync status (icon-button in the header, config-driven via `statusConfig` record). A **StorageIndicator** follows the same pattern — a small conditional segment that shows which storage layer is active:

```ts
// Shown conditionally when OPFS is available (no segment for plain localStorage —
// that's the baseline, not worth calling out)
type StorageStatus = 'opfs' | 'localstorage';

// Example: a small icon or label in the header near SyncIndicator
// OPFS active: HardDrive icon, muted, tooltip "Using device storage (OPFS)"
// localStorage fallback: could show nothing, or a subtle indicator on Settings
```

**Where it lives:** Same header area as `SyncIndicator`, rendered conditionally when `adapter === 'opfs'`. The `adapter` value comes from StorageService and gets threaded through a hook (likely `useBoard` or a new `useStorageService` hook that initializes the singleton).

**Implementation approach:**
- `StorageService.adapter` is read once at init, exposed via context or hook
- No polling, no state changes — it's static for the session lifetime
- Settings page could show a more detailed storage info row (adapter type, estimated usage via `navigator.storage.estimate()`)

### Storage Strategy: OPFS Primary, localStorage Mirror

```
Write path:
  set(key, value)
    → serialize to JSON
    → write to OPFS (async, primary)
    → write to localStorage (sync mirror, fire-and-forget)

Read path (warm):
  get(key)
    → read from OPFS (async, authoritative)
    → return parsed value

Read path (bootstrap):
  getSync(key)  [optional, on StorageService]
    → read from localStorage mirror (sync, for initial render)
    → caller should async-validate with get() after mount
```

The sync mirror means `useBoard` can keep its synchronous `useState(() => loadFromLocal())` pattern unchanged during migration. OPFS becomes the source of truth; localStorage is a read-cache that's written in parallel.

### How GDrive Sync Interacts

The Drive sync layer's interaction barely changes:

```
Before:  useDriveSync → mergeBoards() → replaceBoard() → saveToLocal()
After:   useDriveSync → mergeBoards() → replaceBoard() → storageService.set('board', merged)
```

Specifically:
1. `storage.ts` exports (`saveToLocal`, `loadFromLocal`) become thin wrappers around `storageService.get('board')` / `storageService.set('board', board)`
2. `useDriveSync` continues calling `storage.ts` exports — it never touches StorageService directly
3. Token keys (`ohm-drive-*`) stay in localStorage — owned by toolbox module, out of scope

### What Stays on localStorage (for now)

| Key | Owner | Migrate? | Notes |
|-----|-------|----------|-------|
| `ohm-last-opened` | `useWelcomeBack` | No | Transient timestamp, one read/write per session. Losing it just means no welcome-back prompt — harmless. |
| `ohm-drive-synced` | `useDriveSync` | No | Session flag. If lost, user just reconnects — the refresh token is the real value. |
| `ohm-drive-*` tokens | `.toolbox/lib/google-drive-sync` | **Yes, eventually** | See below. |

**Token durability matters.** The whole impetus for OPFS is surviving Chrome data clearing / storage pressure. If the refresh token is lost, the user has to re-authorize with Google — that's the exact failure this migration aims to prevent. But the tokens are currently managed opaquely by `createDriveSync` via its `storageKeyPrefix` option; the app has no hook into how they're stored.

**Path forward for tokens:**
1. Extend `createDriveSync` to accept a `storage` option (a StorageService or similar async get/set interface) alongside `storageKeyPrefix`
2. When provided, the toolbox module uses the injected storage instead of raw localStorage
3. This is a toolbox-level change — should happen alongside or after StorageService is promoted to `.toolbox/lib/` (Phase 5)
4. Until then, tokens remain on localStorage. The app still works — users just re-auth if storage is cleared

This keeps the migration phases clean: Phases 1–4 prove StorageService in-app on the structured payloads, Phase 5 promotes to toolbox and wires token storage through it.

**Primary migration targets:** `ohm-board` and `ohm-restore-points`.
**Deferred migration target:** `ohm-drive-*` tokens (requires toolbox module change).

### Migration Path

**Phase 1: Introduce StorageService (no behavior change)**
- Create `storage-service.ts` with the interface and factory
- Create `localstorage-adapter.ts` that wraps current localStorage calls
- Create test stub (in-memory `Map<string, string>`)
- Wire `storage.ts` to use StorageService internally — same localStorage adapter, just indirected
- All existing tests pass unchanged

**Phase 2: Add OPFS adapter + status segment**
- Create `opfs-adapter.ts` implementing StorageService
- Feature-detect OPFS availability (`navigator.storage.getDirectory`)
- `createStorageService()` resolves OPFS adapter when available, localStorage adapter as fallback
- Add `getSync()` for bootstrap reads (reads localStorage mirror)
- Add `StorageIndicator` component (mirrors `SyncIndicator` pattern) — shows OPFS icon when active
- Thread `adapter` value from StorageService to the header via hook/context

**Phase 3: Migrate structured payloads**
- `storage.ts` (ohm-board) — highest value, migrate first
- `restore-points.ts` (ohm-restore-points) — second, largest payload benefits most from OPFS
- Transient/primitive keys (`ohm-last-opened`, `ohm-drive-synced`, `ohm-drive-*` tokens) stay on localStorage — no migration needed

**Phase 4: Multi-tab safety**
- Add `BroadcastChannel` write notifications to the OPFS adapter
- Listen for `storage` events on the localStorage mirror as a cross-tab signal
- On incoming signal: mark in-memory state stale, reload on next read
- No leader election needed — just prevent silent data loss

**Phase 5: Toolbox promotion**
- Prove the interface is stable across Phases 1-4 in this app
- Move `storage-service.ts` + adapters to `.toolbox/lib/storage-service`
- Update import path in `src/utils/storage.ts` to `../../.toolbox/lib/storage-service`
- Add vitest alias → `src/test/__stubs__/storage-service.ts`
- Other toolbox consumers (companion apps) import the same module
- OHM-specific wrappers (`stripTransientCards`, `sanitizeBoard`) stay in `src/utils/storage.ts`

### Toolbox Extraction Extension Point

The interface is designed from day one to be extractable, but stays in-app until proven:

- **No OHM-specific types** in the StorageService interface (generic `<T>`)
- **Prefix option** handles namespacing per-app
- **Adapter property** lets each app surface storage info in its own UI
- **Sanitize callback** lets each app define its own validation
- **Adapter pattern** means the toolbox ships the interface + adapters; apps just call `createStorageService()`
- **Same stub pattern** as existing toolbox modules — vitest alias to a test stub that uses an in-memory `Map`

Future toolbox structure (once promoted):
```
.toolbox/lib/
  local-storage-sync.ts      ← existing
  google-drive-sync.ts        ← existing
  storage-service/
    index.ts                  ← createStorageService factory
    opfs-adapter.ts
    localstorage-adapter.ts
    types.ts                  ← StorageService interface, StorageAdapter type
```
