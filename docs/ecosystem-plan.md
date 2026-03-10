# ohm Ecosystem Plan

> Companion apps, external connectors, shared infrastructure, and the orchestrator model. This is future-facing reference material -- see [refactor-plan.md](refactor-plan.md) for the actionable implementation phases.

---

## Orchestrator Model

ohm is the only place where you see all your work, make tradeoff decisions about energy allocation, and feel the satisfaction of completion.

- Owns the canonical view of your day: all cards, all habits, all energy allocation
- The user assigns habit budgets: "Spanish SRS: Low energy, 1 session/day"
- Creates scheduled activities in Charging based on those budgets
- Receives completion events from companions and surfaces them as claimable
- The claim interaction -- card animates from Charging to Powered -- is the reward moment
- Shows energy budget spent vs remaining so you can decide what to do next
- Handles welcome-back summaries and bounce-back detection across everything
- Integrates directly with external APIs (like Hevy) when no companion UI is needed

### The Daily Flow

**Morning staging:**
You open ohm, set your energy level, and stage your day. You've got a Spanish SRS habit budgeted at Low energy, a gym session at Medium (fed by the Hevy connector), and a project card at High. You can see your total load and whether it fits your energy. On a low-energy day, maybe you drop the project card back to Grounded and just keep the two habits.

**Work happens in companions and external tools:**
You open the Spanish companion and do your SRS review. The companion publishes an activity event to the shared DB. Later, you go to the gym and track your workout in Hevy as usual. You don't need to open a separate companion -- Hevy is the facilitator.

**Claiming in ohm:**
You come back to ohm. On load, it polls the Hevy API and finds a new workout since last sync -- it writes that as an activity event to the shared DB. It also checks for unconsumed events from the Spanish companion. The scheduled activities in Charging show pending completions -- a subtle glow or badge count. You tap a card, hit "claim," and it animates down to Powered with a satisfying visual reward. ohm appends its consumption record to each event. You can see at a glance: Spanish SRS is done, gym is done, project card hasn't been touched. Your energy budget is partially spent. You decide what to do next based on what's left and how you're feeling. The family nav shows the Spanish companion is one tap away if you want to do another SRS session.

### Habit Budget Model

Habits are configured in ohm, not in companion apps or external tools. The user defines:

- The habit source: a companion app (detected via registry) or an external API connector (configured on integrations page)
- The energy level (Low / Medium / High)
- The target frequency (1x/day, 3x/week, etc.)
- Whether it auto-stages to Charging each day or requires manual staging

ohm creates the scheduled activity in Charging based on this budget. Neither companions nor connectors create cards -- they only produce activity events.

Activity events come from two sources, but land in the same shared `events` store:

- **From companions:** Written directly to the shared DB by the companion app
- **From connectors:** Polled by ohm on open and written to the shared DB internally

ohm consumes events by matching event types to habit budgets, appending its consumption record, and surfacing them as claimable on the corresponding scheduled activity.

### Load + Energy Mismatch Surfacing

The dashboard can (optionally) surface load/energy mismatches without enforcing anything:

- "You're low energy today with two High cards in Live. That's been a bounce-back pattern for you."
- "High energy today -- you could handle more than what's currently staged."
- "Tomorrow looks packed -- consider moving the High card to Wednesday."

This is coaching, not gatekeeping. The user can ignore it entirely.

---

## Integrations Page

The integrations page serves as the central hub for companion apps, external API connectors, and family navigation.

### Companion Management

- Reads the registry store and displays all registered companion apps
- For each companion: name, icon, last activity timestamp, link to open it
- Configure habit budgets per companion: which habits to track, energy level, frequency, auto-stage preference
- Enable/disable a companion's habits without uninstalling the app
- If a companion isn't registered, it doesn't appear -- no empty states or "install this" prompts

### External API Connectors

- List of available connectors (Hevy, Google Calendar, Fitbit, etc.)
- Each connector has a setup flow: enter API key, authorize, test connection
- Status indicator: connected, last sync, error state
- Configure which habits each connector maps to: "Hevy workout -> Medium energy, 3x/week"
- ohm polls active connectors on open and writes activity instances internally

### When to Build a Companion vs When to Integrate Directly

**Build a companion app when** the domain needs its own facilitation UI -- workflows, tools, and interactions that don't belong in ohm. The Spanish companion has SRS review cards, Plex queue management, phrase capture, and a language assistant. These are real features that need their own screens and UX.

**Integrate directly into ohm when** the external tool is already the facilitator and all you need is the data. Hevy already tracks your sets, reps, and weight. A workout companion wrapping Hevy would just be a passthrough. ohm should talk to Hevy's API directly instead.

**The test:** "Does this domain need screens I'd actually open and use, beyond just seeing the data in ohm?" If yes, companion. If no, ohm integration.

### Connector vs Companion Activity Authoring

- **Companions** author their own Activity definitions in the shared DB. ohm reads them but doesn't create or edit them.
- **Connectors** can't author definitions -- they're external APIs with no presence in the shared DB. ohm authors Activity definitions on their behalf, with full control over name, description, schedule, and metadata via the integrations page.
- The `sourceId` convention distinguishes the two: companion activities use `registry.appId` (e.g. `spanish-companion`), connector activities use a `connector:` prefix (e.g. `connector:hevy`). The toolbox doesn't enforce this -- it's an ohm-level convention.

### Integrations Page Also Shows

- The family nav component status (which apps are available for switching)
- Storage usage across the family
- A "sync now" button to force-poll all active connectors

---

## Connectors

### Hevy Connector

- Setup: user provides Hevy API key (requires Hevy Pro, key from hevy.com/settings?developer)
- On setup, ohm creates Activity definitions on Hevy's behalf. The user configures activity name, description, schedule, and metadata through the integrations page. Example: Activity "Gym Session", schedule MWF mornings, sourceId `connector:hevy`.
- On ohm open: polls `GET /v1/workouts` for sessions since last sync
- For each new workout: writes an ActivityInstance referencing the Hevy activity definition, with meta containing exercise count, total volume, duration, workout title
- User configures the habit budget: "Gym session: Medium energy, target 4x/week, auto-stage"
- ohm surfaces new workouts as claimable on the gym scheduled activity in Charging

### Google Calendar Connector

- Setup: user enables on integrations page, triggers incremental OAuth consent for `calendar.events` and `calendar.tasks` scopes
- Bidirectional integration -- reads from Calendar and pushes to Calendar

**Reading from Calendar (Calendar -> ohm):**

- On ohm open: pulls today's calendar events and tasks via the Calendar API
- Surfaces them as cards in Charging alongside scheduled activities and project work
- User configures which calendars to pull from and what energy level to assign by default (e.g. "Work calendar events = Medium, Personal = Low")
- Calendar events show their time block -- ohm knows "this meeting is at 2pm, Medium energy" and can factor it into your energy budget for the day
- Tasks from Google Tasks surface as cards too, with user-configured energy levels
- These are read-only references -- ohm doesn't modify the calendar events, just represents them in your daily staging view

**Pushing to Calendar (ohm -> Calendar):**

- Activity definitions with matching schedules can optionally push to Google Calendar as tasks for the current day
- When ohm stages a scheduled activity for today (based on the activity definition's schedule), it creates a corresponding Google Calendar task
- This gives you reliable calendar notifications for free -- no push infrastructure needed
- When a scheduled activity is claimed (moved to Powered), ohm can mark the corresponding Calendar task as complete
- User configures per-activity whether to push to Calendar and which calendar to target
- Only pushes for the current day -- ohm doesn't flood your calendar with future scheduled activities

**What this solves:**

- **Notification problem:** Google Calendar notifications are rock solid on every platform. Activity schedules pushed as Calendar tasks give you reliable reminders without a backend.
- **Full daily picture:** ohm already shows scheduled activities and project work. Adding calendar events means you see meetings, appointments, habits, and project work all in one staging view with energy levels, so you can make realistic energy allocation decisions.
- **No double entry:** Calendar events you've already scheduled don't need to be recreated as ohm cards manually. They just appear.

### Future Connectors

Fitbit (sleep quality, step count), Letterboxd (movie watching habits), Bluesky (posting streak?), or anything else with a REST API.

---

## Companion Apps

### Spanish Learning Companion

> A thin PWA for conversational Spanish learning. Facilitates immersion tracking, phrase capture, and spaced repetition. Publishes activity events to the shared DB for ohm to orchestrate.

**Philosophy:**

- Learning first, tooling supports it
- Aural-first, text-supporting -- prioritize listening/speaking workflows
- Mexican Spanish focus
- Works fully standalone -- ecosystem awareness is optional

**Features:**

- **Daily Dashboard:** Current phase (foundation / building / momentum) and week number. Suggested activity based on recent patterns and phase. Streak counters. Quick Spark capture button. Welcome-back summary.
- **Plex Immersion Tracker:** Connects to local Plex server via REST API. Scans libraries for Spanish audio tracks. Phase-based watch suggestions. Auto-logs immersion sessions from Plex watch history. Tracks cumulative immersion hours.
- **Phrase Capture + Spaced Repetition:** Quick Spark FAB -> type or voice-record phrase -> add translation manually -> optionally tag source and difficulty. FSRS algorithm (ts-fsrs) schedules reviews. Cards show Spanish on front, translation/context on back.
- **Habit Logger:** Simple check-ins for Language Transfer lessons, Pimsleur sessions, real-world interactions. Becomes redundant for any habits ohm is tracking once ecosystem is wired.
- **Optional Gemini Integration:** Auto-enrichment of captured phrases (translation, pronunciation guide, example sentences, conjugation notes). Lightweight language assistant chat. System prompt emphasizes Mexican Spanish, conversational register, Texas/DFW context.

**Tech Stack:** React + Vite PWA (toolbox scaffolding), ts-fsrs, IndexedDB via Dexie, Plex REST API, Web Speech API.

**Build Phases:**

- Phase A -- Shell + Habits (after 2-3 weeks of studying): Dashboard, habit logger, streaks. Standalone.
- Phase B -- Plex Integration: Plex connection, Spanish audio scanning, immersion logging, phase-based queue.
- Phase C -- Phrase Capture + SRS: Quick Spark, FSRS review scheduling, optional Gemini.
- Phase D -- Ecosystem Wiring: Register in shared DB, publish activity events, render family nav.

### Future Companion Ideas

**Movie Companion:** Alamo events already show up via Calendar connector in ohm. A companion might add watchlist management, reaction logging, Spanish-language immersion tracking, and Letterboxd integration -- but the shape is unclear. Might just use Calendar + custom activities until friction justifies building it.

**Voice Acting Companion:** Practice tracking (vocal warmups, articulation drills, cold reads), recording catalog, audition log, portfolio/showcase page. Practice side fits the habit model well. Very early -- start doing the practice before building the tool.

**General Pattern:** Any companion follows the same structure: standalone app that facilitates a specific domain, publishes activity events to the shared DB, renders family nav if other apps are registered. Optional integrations on its own integrations page. Works fully without ohm.

---

## Sync Strategy

### Debouncing

Each data source has a `lastSyncAt` timestamp and minimum interval:

- **Shared DB (activity instances, registry):** 30 seconds
- **External APIs (Hevy, Calendar):** 15 minutes
- **"Sync now" button** overrides all intervals

### Write Batching

ohm's writes (consumption records, Calendar task completions, connector-polled instances) batch in memory and flush periodically (every 30 seconds or on significant state changes like claiming a card).

### Best-Effort Flush on Close

```typescript
// On visibilitychange (hidden) or beforeunload:
if (pendingWrites.length > 0) {
  navigator.serviceWorker.ready.then((reg) => {
    reg.sync.register('flush-pending-writes');
  });
}

// In the Service Worker:
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-pending-writes') {
    event.waitUntil(flushPendingData());
  }
});
```

Background Sync works on Chrome/Edge/Android. Not Safari/iOS. Fallback: flush unflushed writes on next open.

### Sync Summary

| Source                          | Direction  | Debounce | Flush on Close  |
| ------------------------------- | ---------- | -------- | --------------- |
| Shared DB (instances)           | Read       | 30 sec   | N/A (local)     |
| Shared DB (consumption records) | Write      | 30 sec   | Yes             |
| Hevy API                        | Read       | 15 min   | N/A (read-only) |
| Google Calendar (events/tasks)  | Read       | 15 min   | N/A (read-only) |
| Google Calendar (task push)     | Write      | On claim | Yes             |
| Registry                        | Read/Write | On open  | N/A             |

---

## Notifications

PWA notification scheduling is limited. The reliable options:

- **Push API** -- reliable but requires a backend
- **Periodic Background Sync** -- unreliable on mobile, not on iOS
- **Notification on app open** -- only works when already open
- **Native alarms** -- Fitbit/phone alarms are more reliable for time-based reminders

**Practical strategy:** The Google Calendar connector is the primary reminder path. Activity schedules pushed as Calendar tasks give you rock-solid notifications on every platform without a backend. PWA notifications are a progressive enhancement.

---

## Debug / Diagnostics Page

A standard diagnostics page in the toolbox template. Every PWA gets it for free. Accessible via `/debug` or a hidden gesture (tap version number 7 times).

### Core Diagnostics (every app)

- Notification: permission status, test fire, device capability notes
- Service Worker: registration state, cache contents, force update/unregister
- IndexedDB: databases, schema version, store contents, storage quota
- PWA Install: standalone vs browser, manifest metadata
- Device/Browser: user agent, online/offline, Web Speech API availability

### App-Specific Diagnostics

**ohm:** Energy state, rolling window status, Charging queue with total load, registered apps, connector statuses (Hevy, Calendar), family nav state.

**Spanish Companion:** Plex connectivity, Spanish audio track scan, FSRS status, Web Speech API (Spanish voices), Gemini integration status.

### Implementation

- Reusable React component: `import { DebugPage } from '.toolbox/debug'`
- Each app passes companion-specific diagnostics as config
- All output on-page (usable on mobile without dev tools)
- "Copy diagnostics report" button for clipboard sharing

---

## Toolbox Shared Infrastructure

The toolbox provides a **generic, domain-agnostic** shared infrastructure layer for a family of apps on a shared origin. It doesn't know about ohm, Spanish learning, or fitness. It provides three things: a persistent event store (via IndexedDB), an app registry, and a navigation component.

### Registry

```typescript
interface RegistryEntry {
  appId: string; // internal identifier
  name: string; // UI-friendly: "Spanish Companion"
  icon: string; // lucide icon name or path
  basePath: string; // navigation path: "/spanish"
  clearDataPath: string; // cleanup route: "/spanish/clear"
  registeredAt: string; // ISO 8601
  lastActiveAt: string; // ISO 8601, updated on each open
}
```

### Shared Database

```typescript
const db = new Dexie('app-family');

db.version(1).stores({
  registry: 'appId',
  activities: 'activityId, sourceId',
  instances: 'instanceId, activityId, timestamp',
});
```

### Family Navigation

Reusable `<FamilyNav />` React component. Reads the registry, renders a switcher. If only one app is registered, doesn't render. Same-origin navigation feels like switching sections of one app.

### Clear Data & App Removal

`clearAppData(appId)` and a minimal `ClearDataPage` route component. ohm's integrations page detects stale apps (`lastActiveAt` older than threshold), prompts for removal, and opens the app's `clearDataPath` URL for cleanup.

### Shared Google Auth

- One OAuth client for `apps.samm-the.dev`
- One sign-in across the family
- Incremental scopes per app
- Shared token storage on the shared origin

### Data Flow Principles

- **One-directional.** Companions push to the shared DB. ohm pulls. Companions never read from ohm.
- **No runtime dependency.** Companions work fully standalone. Activity instances accumulate until consumed, or forever.
- **Eventually consistent.** No real-time sync. Apps process on next load.
- **Minimal shared surface.** Only `Activity`, `ActivityInstance`, `RegistryEntry`, and utilities. No app's internal models leak into the shared schema.
- **GUIDs everywhere.** Avoids sequential collisions across offline/out-of-sync apps.

### Dev-Mode Gotcha

IndexedDB is scoped to origin including port. `localhost:5173` and `localhost:5174` are different origins. Options: same-port dev proxy, shim, or test in staging.

---

## Open Questions / Future Seeds

- **ADHD fidelity check (evaluate continuously):** Does any of this break the original goal -- task management for an ADHD brain using personal kanban principles? Every feature needs to pass the test: "Does this make the daily experience simpler, or does it just make the system more capable?"
- **Custom activities in ohm:** For domains without a companion app (improv class, Build-a-Jam practice, etc.), ohm should support manually created activity definitions with custom schedules.
- **Sleep/recovery as energy context:** Fitbit API or manual sleep quality check-in to factor into energy-level suggestions.
- **Reading/learning log:** Lightweight tracking for tutorials, courses, chapters. May just be custom activities in ohm.
- **Companion integrations pattern:** Each companion can have its own integrations page (Spanish companion has Gemini, etc.).
- **Drive appdata sync:** Shared Google Drive appdata folder for lightweight cross-device sync without a backend.
- **Toolbox integrations shell:** Reusable integrations page component -- each app plugs in connector configs, gets setup/status/enable-disable UX for free.
- **Share Target for phrase capture:** Register Spanish companion as a Web Share Target for receiving text from other apps.
