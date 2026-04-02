@.toolbox/ai-context/CLAUDE.md
@todo.md

---

## OHM — Personal Kanban for ADHD Brains

A kanban app using an electrical metaphor to map energy cycles into a visual workflow.

### Architecture

- **React 19** + TypeScript, Vite, Tailwind CSS
- **dnd-kit** for drag-and-drop
- **localStorage** persistence + optional **Google Drive** sync
- Single-page app, no router

### Four-Column Model (display order)

| Column   | Metaphor         | Purpose                            |
| -------- | ---------------- | ---------------------------------- |
| Powered  | Circuit complete | Done today (trophy case)           |
| Live     | Active           | Currently working on (daily limit) |
| Charging | Building energy  | Scheduled ahead (future dates)     |
| Grounded | Paused           | Unscheduled backlog                |

`ColumnStatus` numeric values: Grounded=0, Charging=1, Live=2, Powered=3. `COLUMN_ORDER` array controls display sequence (Powered first) without changing persistence.

### Key Conventions

- **Index-based data model**: `ColumnStatus` uses numeric indices with named constants (`STATUS.CHARGING`). `COLUMNS` array indexed by status; `COLUMN_ORDER` controls render sequence. `sanitizeBoard()` validates on load, defaults `dailyLimit`, prunes archived cards.
- **State**: `useBoard` hook (functional updates) + `board-utils.ts` (pure mutation functions). Debounced localStorage saves (500ms).
- **Capacity**: Flat daily item limit (`dailyLimit`, default 3, range 1-5) replaces energy-based capacity. BudgetBar shows item-count pips with energy tinting. DayFocusDialog shows mini pip meters per day.
- **Soft-delete archive**: Powered cards get `archivedAt` timestamp on day rollover. Hidden from UI, pruned after 14 days by `sanitizeBoard()`.
- **Expanded cards**: Live/Powered columns show larger title, description preview (3-line clamp), and full task list. Charging/Grounded keep compact layout.
- **Theming**: Dark theme. Status colors = `ohm-charging/live/grounded/powered`. Energy colors use continuous HSL scale (`energyColor()`). Labels/icons are re-themeable without data migration.
- **CardDetail** handles both creation (`isNew` mode) and editing with contextual field visibility.
- **Mobile-first** responsive layout. Desktop uses CSS grid (4-col with spanning headers). Filter bar: energy/category/date/search with mobile-friendly collapsible UI.

### Testing

@.toolbox/ai-context/testing.md

- **Vitest + RTL + jsdom**. Setup: `src/test/setup.ts`. Config: `vitest.config.ts`.
- **Toolbox stubs**: specific `.toolbox/lib` modules used in production (e.g., `../../.toolbox/lib/local-storage-sync`) are aliased in `vitest.config.ts` to matching files in `src/test/__stubs__/`. When adding a new toolbox stub, add an explicit alias from the module's import path to its stub file. See the stub isolation pattern in the testing companion above.
- **IndexedDB**: `useActivities` tests import `fake-indexeddb/auto` for Dexie. Production code touching Dexie asynchronously (e.g., `replaceBoard`'s instance cleanup) should `try/catch` for test environments without IndexedDB.
- **`act()` wrapping**: All state-updating hook calls (including helpers like `quickAdd`) must be inside `act()` — unwrapped calls cause async re-renders that leak between tests.

### Google Drive Auth

Dual-flow OAuth: authorization code flow (persistent) when `VITE_TOKEN_EXCHANGE_URL` is set, implicit flow (session-only) as fallback. See `src/utils/google-drive.ts`.

### Cloud Function

GCP Cloud Function (gen2, runs on Cloud Run, Node 22, us-central1) that proxies OAuth token exchange/refresh, keeping the client secret server-side. Deployed to project `ohm-adhd-kanban`. Function source is shared via the toolbox submodule at `.toolbox/google-cloud-auth/function/`. Deploy config is at `google-cloud-auth.config.json` (repo root). **No CI deploy** -- changes require manual redeploy: `powershell -ExecutionPolicy Bypass -File .toolbox/google-cloud-auth/deploy.ps1` (needs `gcloud` CLI authenticated). See `.toolbox/ai-context/google-cloud-auth.md` for full setup details.
