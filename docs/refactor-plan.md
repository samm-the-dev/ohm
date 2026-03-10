# ohm Refactor Plan

> Evolving ohm from a personal kanban into an ADHD-informed energy orchestrator with a rolling time horizon, external integrations, and a companion app ecosystem.

This plan distills the ecosystem vision, schema.org alignment, and implementation decisions into actionable phases.

---

## Core Principles

- **ADHD-first.** Every feature must reduce cognitive overhead, not add it.
- **Energy over time.** Load levels and energy states matter more than hours and deadlines.
- **Progressive complexity.** The abstract kanban is always available. Time features are an optional lens on the same data model.
- **ohm is where the win lands.** Companions and external tools do the work. ohm is the full picture.

---

## Decisions Made

| Decision                  | Outcome                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Energy tiers              | Continuous 1–6 scale (value = weight). HSL gradient coloring from green (1) to red (6).                                                                                                   |
| Recurrence model          | schema.org `Schedule` via `schema-dts`, not cron strings. Queryable, self-documenting, companion-portable.                                                                                |
| schema.org adoption       | Import `DayOfWeek` and `ActionStatusType` directly. `StoredSchedule` mirrors `ScheduleBase` field names with narrowed types. `schema-dts` is a devDependency for compile-time validation. |
| Persistence migration     | Dexie for activity/instance stores. Board stays in localStorage.                                                                                                                          |
| Activity sourceId         | `"ohm"` for native activities, companion `appId` for companion-sourced, `"connector:<name>"` for external API connectors.                                                                 |
| Card <-> ActivityInstance | Cards are the UI representation. Instances are the data record. Card `activityInstanceId` links to the instance. Instance `status` mirrors card column position.                          |
| Type organization         | New types in separate files: `schedule.ts`, `activity.ts`. Existing `board.ts` gets optional temporal fields (no version bump — no existing users).                                       |
| Capacity model            | Single `energyBudget` for the rolling window replaces per-column capacities. `liveCapacity` stays separate. `autoBudget` toggle auto-calculates Total = Window × Live.                    |
| Auto-demotion             | Charging cards with `scheduledDate` before today auto-demote to Grounded when time features enabled.                                                                                      |
| Auto-archive              | Powered cards outside the trailing window silently removed.                                                                                                                               |
| Positive reinforcement    | Powered column ambient glow scales with trailing completion progress.                                                                                                                     |
| Testing scope             | Core coverage: `useBoard` hook, `board-utils` pure functions, `sanitizeBoard` migration, `mergeBoards`. Circle back for broader coverage later.                                           |
| Abstract kanban           | Always available. Time features toggle controls all temporal behavior. Some UI change is acceptable since the app has no active users yet.                                                |

---

## Phases

### Phase 0 + 1 + 2: Data Model, Tests, Time Features, Activity System ✅

Completed in PR #20. Combined into a single PR.

- Data model: `StoredSchedule`, `Activity`, `ActivityInstance`, `ActivityStatus`, board temporal fields
- Dexie IndexedDB for activity/instance stores; board stays in localStorage
- Test foundation: board-utils, useBoard, useActivities, schedule-utils, storage, restore-points
- Rolling window (1–7 days), auto-staging, `exceptDate` support, time features toggle
- Auto-demotion (stale Charging → Grounded), auto-archive (expired Powered removed)
- `energyBudget` replaces per-column capacities, `autoBudget` toggle
- `useActivities` hook, `ActivityManager` UI, instance materialization
- Daily + total energy meters, Powered column glow
- Dual-range energy filter slider, desktop steppers, 2-row filter layout

### Phase 3: Integrations Page + Shared Infra

- Integrations page in ohm (companion management, connector setup, family nav status)
- Toolbox `shared-schema/` extraction: Dexie DB definition, Activity types, Registry, FamilyNav component
- App registry for companion discovery
- Custom activities: manual schedule definitions for domains without a companion (improv class, Build-a-Jam, etc.)
- `clearAppData()` utility and `ClearDataPage` route component

### Phase 4+: Connectors & Companions

**Hevy connector:**

- Poll `GET /v1/workouts` for sessions since last sync
- Write `ActivityInstance` with exercise metadata
- Surface as claimable on gym scheduled activity

**Google Calendar connector:**

- Bidirectional: read events into Charging, push activity tasks for notifications
- Incremental OAuth consent for calendar scopes
- Per-calendar load level configuration

**Spanish companion (separate repo):**

- Register in shared DB, publish activity events
- FamilyNav renders across apps
- Companion's habit logger becomes redundant for ohm-tracked habits

---

## Data Model

### StoredSchedule (schema.org aligned)

Mirrors `ScheduleBase` field names from `schema-dts` with narrowed types for Dexie storage.

```typescript
import type { DayOfWeek } from 'schema-dts';

interface StoredSchedule {
  repeatFrequency: string; // ISO 8601 duration: "P1W", "P1D"
  byDay?: DayOfWeek[]; // "Monday", "Wednesday", "Friday"
  byMonth?: number[];
  byMonthDay?: number[];
  startDate?: string; // ISO date
  endDate?: string; // ISO date (null = ongoing)
  startTime?: string; // "HH:mm"
  duration?: string; // ISO 8601 duration: "PT90M"
  exceptDate?: string[]; // ISO dates to skip
  scheduleTimezone?: string; // IANA: "America/Chicago"
}
```

### ActivityStatus (schema.org actionStatus aligned)

```typescript
import type { ActionStatusType } from 'schema-dts';

const ACTIVITY_STATUS = {
  POTENTIAL: 'PotentialActionStatus', // Charging
  ACTIVE: 'ActiveActionStatus', // Live
  COMPLETED: 'CompletedActionStatus', // Powered
  FAILED: 'FailedActionStatus', // Grounded
} as const satisfies Record<string, ActionStatusType>;

type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];
```

### Activity (template for recurring things)

```typescript
interface Activity {
  id: string; // GUID
  sourceId: string; // "ohm", companion appId, or "connector:<name>"
  name: string;
  description?: string;
  schedule?: StoredSchedule;
  energy?: EnergyTag; // ohm-specific extension
  meta?: Record<string, unknown>;
}
```

### ActivityInstance (single occurrence)

```typescript
interface ActivityInstance {
  id: string; // GUID
  activityId: string; // FK to Activity
  scheduledDate: string; // ISO date
  status: ActivityStatus;
  claimedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  meta?: Record<string, unknown>;
  consumedBy?: ConsumptionRecord[];
}

interface ConsumptionRecord {
  appId: string;
  consumedAt: string; // ISO timestamp
}
```

### OhmCard additions

```typescript
interface OhmCard {
  // ... existing fields unchanged ...
  scheduledDate?: string; // ISO date (time features)
  activityInstanceId?: string; // links to ActivityInstance
}
```

### OhmBoard additions

```typescript
interface OhmBoard {
  version: 1;
  // ... existing fields ...
  energyBudget: number; // total energy segments for the rolling window
  liveCapacity: number; // energy segments limit for Live column (today)
  // chargingCapacity and groundedCapacity removed -- replaced by energyBudget
  timeFeatures?: boolean; // enable rolling window + schedules
  windowSize?: number; // rolling window days (default 7, max 7)
  autoBudget?: boolean; // auto-calculate energyBudget = windowSize × liveCapacity
}
```

---

## schema.org Adoption Summary

| Type                       | Usage                           | How                                                      |
| -------------------------- | ------------------------------- | -------------------------------------------------------- |
| `DayOfWeek`                | Schedule recurrence days        | Import directly from `schema-dts`                        |
| `ActionStatusType`         | Activity instance lifecycle     | Import directly, `satisfies` constraint on status enum   |
| `ScheduleBase` field names | `StoredSchedule` interface      | Mirror names, narrow `SchemaValue` unions to plain types |
| `Action`                   | Reference for instance shape    | Borrow field naming convention                           |
| `PropertyValue`            | Activity metadata extensibility | Reference for `meta` field patterns                      |

Tier 2/3 types (Recipe, HowTo, Game, etc.) are companion-specific and will be adopted in those repos.

---

## Toolbox Shared Infrastructure (Phase 3+)

Extracted to `.toolbox/lib/shared-schema/`:

```
db.ts            -- Shared Dexie database (registry, activities, instances)
activity.ts      -- Activity and ActivityInstance types
schedule.ts      -- StoredSchedule type
registry.ts      -- RegistryEntry type
storage.ts       -- Namespaced localStorage/sessionStorage utility
clear.ts         -- clearAppData() utility and ClearDataPage component
nav.ts           -- FamilyNav component
```

### Domain Strategy

Apps on a single origin under different paths:

- `apps.samm-the.dev/ohm`
- `apps.samm-the.dev/spanish`

Same origin = shared IndexedDB. Each app is its own repo and build.

### Data Flow

- One-directional: companions push to shared DB, ohm pulls
- No runtime dependency: companions work fully standalone
- Eventually consistent: apps process on next load
- GUIDs everywhere: avoids sequential collisions across offline apps

---

## Open Questions

- **Keyboard shortcuts:** Independent of the refactor, can be added anytime.
- **Analytics:** Completion rates, time-in-column trends. Depends on activity instance history.
- **Custom activities in ohm:** For domains without a companion. Shape TBD in Phase 3.

---

## Sequencing Guidance

> This plan is a destination, not a starting point. Build incrementally. Let real friction guide what gets built next.

Phase 0–2 shipped in PR #20. Phase 3+ is future work triggered by ecosystem needs.
