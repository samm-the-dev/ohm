@.toolbox/templates/ai-context/CLAUDE.md

---

## Ohm — Personal Kanban for ADHD Brains

A kanban app using an electrical metaphor to map energy cycles into a visual workflow.

### Architecture

- **React 19** + TypeScript, Vite, Tailwind CSS
- **dnd-kit** for drag-and-drop
- **localStorage** persistence + optional **Google Drive** sync
- Single-page app, no router

### Four-Column Model

| Column   | Metaphor        | Purpose                                 |
| -------- | --------------- | --------------------------------------- |
| Charging | Building energy | Captured ideas with a clear next step   |
| Grounded | Paused          | Captured "where I left off" context     |
| Live     | Active          | Currently working on (capacity limited) |
| Powered  | Done            | Completed                               |

### Key Conventions

- **Index-based data model**: `ColumnStatus` and `EnergyTag` are numeric indices with named constants (`STATUS.CHARGING`, `ENERGY.MED`). Config arrays indexed by these values; `sanitizeBoard()` validates on load.
- **State**: `useBoard` hook (functional updates) + `board-utils.ts` (pure mutation functions). Debounced localStorage saves (500ms).
- **Capacity**: Live column uses energy segments (Small=1, Med=2, Large=3), not card count. Green-to-red gradient indicator.
- **Theming**: Dark theme. Status colors = `ohm-charging/live/grounded/powered`. Energy colors = `ohm-energy-low/med/high` (stoplight). Labels/icons are re-themeable without data migration.
- **CardDetail** handles both creation (`isNew` mode) and editing with contextual field visibility.
- **Mobile-first** responsive layout. Filter bar: energy chips + expandable category/search.

### Google Drive Auth

Dual-flow OAuth: authorization code flow (persistent) when `VITE_TOKEN_EXCHANGE_URL` is set, implicit flow (session-only) as fallback. See `src/utils/google-drive.ts`.

### Cloud Function

GCP Cloud Function (gen2, runs on Cloud Run, Node 22, us-central1) that proxies OAuth token exchange/refresh, keeping the client secret server-side. Deployed to project `ohm-adhd-kanban`. Function source is shared via the toolbox submodule at `.toolbox/google-cloud-auth/function/`. Deploy config is at `google-cloud-auth.config.json` (repo root). **No CI deploy** -- changes require manual redeploy: `powershell -ExecutionPolicy Bypass -File .toolbox/google-cloud-auth/deploy.ps1` (needs `gcloud` CLI authenticated). See `.toolbox/templates/ai-context/google-cloud-auth.md` for full setup details.
