# Today Focus Redesign

## Vision

Shift OHM from a rolling-window energy planner to a **today-focused task board**. Drop past records from the UI, simplify capacity to a flat 3-item limit, and reorder columns so "now" leads.

---

## Column Model

### New order (left → right on desktop, top → bottom on mobile)

| Position | Column      | What lives here                        |
| -------- | ----------- | -------------------------------------- |
| 1        | **Powered** | Done today (trophy case, clears daily) |
| 2        | **Live**    | Working on right now                   |
| 3        | **Charging**| Scheduled ahead (future dates)         |
| 4        | **Grounded**| Unscheduled backlog                    |

Reading direction: **present → future → someday**. Powered leads because wins should be the first thing you see.

### Data model

`ColumnStatus` numeric values stay the same (Grounded=0, Charging=1, Live=2, Powered=3). Only the **render order** changes — a new `COLUMN_ORDER` array controls display sequence without breaking persistence or transitions.

```ts
export const COLUMN_ORDER = [STATUS.POWERED, STATUS.LIVE, STATUS.CHARGING, STATUS.GROUNDED] as const;
```

---

## Today Meter

Replaces the energy-based BudgetBar with a simple 3-segment indicator.

### Rules

- **Capacity = 3 items** (cards in Live + today's Powered).
- Each segment = one slot. Fills left-to-right as cards enter Live or move to Powered.
- Segments are binary (filled/empty) — no subdivision, no energy weighting.
- Visually spans above **Powered + Live** on desktop. On mobile, sits at the top of the screen above Live.

### Overflow

If a 4th card somehow lands in Live (e.g. imported, activity-spawned), the meter shows a "+1" badge. No hard block — ADHD brains need escape valves.

### Card limit setting

Stored as `board.dailyLimit` (default 3). Configurable in Settings (range 1–5). Replaces `liveCapacity` and `energyBudget`.

---

## What's Ahead Summary

A compact bar showing **category counts** across Charging + Grounded cards.

### Desktop
- Rendered as a shared header above Charging + Grounded columns.
- Format: colored chips — `work ×4 · personal ×2 · health ×1`

### Mobile
- Rendered between the Live and Charging sections as a section divider/header.
- Same chip format, single scrollable row if overflow.

### Data

Simple reduce over `board.cards` where `status ∈ {CHARGING, GROUNDED}`, grouped by category. Uncategorized cards either omit or show as "other".

---

## Powered Column Changes

- **Today only**: shows cards completed today. No date grouping needed — it's all one day.
- **Auto-clear**: on day rollover (or app open on new day), yesterday's Powered cards are silently deleted (same as current archive, but window = 1 day).
- **Read-only**: cards in Powered remain non-editable (current behavior).

---

## Card Display

With max 3 cards in Live + Powered, there's room to show more per card.

### Expanded card layout (Live + Powered columns)

- **Title** (larger, no truncation)
- **Description** (first 2-3 lines visible, not just preview)
- **Task checklist** (interactive in Live, read-only in Powered)
- **Category + scheduled date** as secondary metadata

### Charging + Grounded columns

- Keep current compact card layout (title, energy badge, category pill, task preview).
- Stale indicator remains (opacity fade after 14 days).

---

## Removed / Simplified

| Current feature         | Change                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Energy budget (total)   | Removed — capacity is item count                              |
| Energy per card         | **Kept** as optional card metadata, but not used for capacity |
| Rolling window          | Removed — window is always "today"                            |
| `windowSize` setting    | Removed from settings UI                                      |
| `autoBudget` toggle     | Removed                                                       |
| BudgetBar (daily rows)  | Replaced by Today Meter                                       |
| DayFocusDialog          | Removed (Powered is already today-only)                       |
| `energyBudget` field    | Deprecated, ignored if present                                |
| `liveCapacity` field    | Deprecated, replaced by `dailyLimit`                          |

---

## Daily Color Theme

Deterministic daily accent color, seeded by date string.

### Mechanism

```ts
function dailyHue(date: string): number {
  // Simple hash of "YYYY-MM-DD" → hue 0-360
  let hash = 0;
  for (const ch of date) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}
```

### What changes

- `--color-ohm-spark` shifts to the daily hue (keeps same saturation/lightness).
- Column header tints get a subtle hue blend toward the daily color.
- Background and text colors stay fixed for readability.

### Toggle

`board.funSettings.dailyTheme: boolean` (default false). Shown in a new **Fun** settings tab.

---

## Fun Modules (Future)

Opt-in engagement features under `board.funSettings`.

### Dark Souls Messages

- Date-seeded random message displayed somewhere unobtrusive (footer, empty-state, or toast on app open).
- Separate package: `@ohm/dark-souls-messages` or similar. Exports `getMessage(date: Date): string`.
- Could be a submodule or npm package — keep it out of the main bundle unless enabled.

#### Data source

Message templates and vocabulary can be extracted directly from a local PC install of Dark Souls (DSR/DS3) or Elden Ring. The soapstone message system is two parts:

- **`BloodMsg.fmg`** — sentence templates with blanks (e.g. "try ___ ahead")
- **`Word_*.fmg`** — vocabulary by category (`ActionConcepts`, `Body`, `Directions`, `Objects`, `Creatures`, etc.)

These FMG files live inside `<game>/msg/engus/item.msgbnd.dcx` (compressed BND archive). Extraction options:

| Tool | Type | Notes |
|---|---|---|
| **soulstruct** (`pip install soulstruct`) | Python lib | Reads BND+FMG directly, exports to dict/JSON. Supports DSR and DS3. |
| **Smithbox** | GUI (Windows) | Text Editor tab browses all FMG text. Supports DS1/2/3/ER/AC6. |
| **Yabber+** | CLI (Windows) | Unpacks `.msgbnd.dcx` → individual `.fmg` files for separate parsing. |

Quickest path: soulstruct one-liner to dump `BloodMsg` + `Word_*` entries to JSON, then ship as static data in the package.

### Architecture

```ts
interface FunSettings {
  dailyTheme?: boolean;
  darkSoulsMessages?: boolean;
  // future: more fun modules
}
```

Added to `OhmBoard` as `funSettings?: FunSettings`. Missing = all off.

---

## Settings Changes

### Board tab (simplified)

- **Daily limit**: spinner (1–5, default 3)
- **Energy scale**: keep as-is (optional card metadata)
- **Categories**: keep as-is

### Remove from Board tab

- Live capacity, total budget, auto-budget, window size

### New: Fun tab

- Daily color theme toggle
- Dark Souls messages toggle (when available)

---

## Migration

On load, `sanitizeBoard()` handles transition:

1. If `dailyLimit` is missing, set to `3`.
2. `liveCapacity` / `energyBudget` / `windowSize` / `autoBudget` remain in the type for backwards compat but are ignored by all new logic.
3. No data migration needed for cards — they already have `status` and `scheduledDate`.
4. Powered auto-clear naturally trims old cards on first load.

---

## Implementation Order

1. **Column reorder** — `COLUMN_ORDER` array, update Board.tsx render loop
2. **Today Meter** — new component replacing BudgetBar, `dailyLimit` field
3. **Powered today-only** — simplify archive to 1-day window
4. **Expanded card layout** — richer display for Live/Powered cards
5. **What's Ahead** — category summary bar
6. **Daily color theme** — hue rotation, fun settings
7. **Settings cleanup** — remove old capacity controls, add Fun tab
8. **Documentation overhaul** — update all docs to reflect the redesign (see below)

---

## Process & Documentation

### BMAD + Open Spec adoption

Once the redesign is implemented, adopt **BMAD** (Build Measure Analyze Decide) and **Open Spec** methodologies for the project going forward:

- **BMAD workflow**: structure future feature work as cycles — define the build scope, identify what to measure (user engagement, task completion patterns), analyze results, decide next iteration. This fits naturally with the Fun Modules pattern where features are opt-in and can be evaluated independently.
- **Open Spec**: publish a living specification for OHM's data model, column semantics, and extension points (fun modules, sync adapters). This makes the project's design decisions transparent and gives structure to contributions or forks.
- Evaluate which BMAD/Open Spec artifacts make sense at OHM's scale — avoid over-process for a personal tool. Likely candidates: a lightweight product spec, a decision log, and per-feature build/measure criteria.

### Documentation update (post-implementation)

All project docs should be updated once the redesign lands:

- **README.md** — update the column table, philosophy bullets, features list, and both standards alignment tables (Kanban Method + ADHD Research) to reflect the new model. The 3-item capacity strengthens several alignment claims (see analysis in the redesign discussion).
- **CLAUDE.md** — update architecture notes: column model, capacity system (`dailyLimit` replacing energy budget), new components (Today Meter, What's Ahead), fun settings. Remove references to rolling window, `liveCapacity`, `energyBudget`, BudgetBar, DayFocusDialog.
- **todo.md** — remove completed items from this redesign, add any new items surfaced during implementation (e.g. analytics groundwork, fun module ideas).
- **docs/** — consider whether the redesign plan itself should be archived or replaced with a living spec (ties into Open Spec adoption above).
