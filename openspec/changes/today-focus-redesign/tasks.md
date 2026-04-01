# Today Focus Redesign -- Tasks

## 1. Column Reorder + Desktop Grid Layout

- [x] 1.1 Add `COLUMN_ORDER` array to `src/types/board.ts`: `[STATUS.POWERED, STATUS.LIVE, STATUS.CHARGING, STATUS.GROUNDED]`
- [x] 1.2 Update `Board.tsx` render loop to iterate `COLUMN_ORDER` instead of `COLUMNS.map((col, index))`
- [x] 1.3 Replace `md:flex-row` layout in Board.tsx with CSS grid: `grid-template-columns: repeat(4, 1fr)` at md+ breakpoint
- [x] 1.4 Add two spanning header slots in grid (cols 1-2 for BudgetBar, cols 3-4 for What's Ahead placeholder)
- [x] 1.5 Keep mobile layout as single-column flex stack
- [ ] 1.6 Verify column order on desktop and mobile, check drag-and-drop still works within columns
- [x] 1.7 Run build to verify no TypeScript errors

## 2. BudgetBar Adaptation

- [x] 2.1 Add `dailyLimit: number` to `OhmBoard` type in `src/types/board.ts`
- [x] 2.2 Add `setDailyLimit` to `useBoard` hook (clamp 1-5, update `capacitiesUpdatedAt`)
- [x] 2.3 Rewrite BudgetBar daily segments: item-count pips instead of energy ratio bars
- [x] 2.4 Add energy tinting: color/size pips by card energy levels
- [x] 2.5 Add prominent 3-segment today indicator for Live + today's Powered count vs `dailyLimit`
- [x] 2.6 Replace total row: item count across 14-day forward window
- [x] 2.7 Add "+N" overflow badge when cards exceed `dailyLimit`
- [x] 2.8 Move BudgetBar from fixed-bottom to grid header area on desktop (keep mobile positioning)
- [x] 2.9 Update Board.tsx budget data calculation: 14-day forward window, item counts
- [x] 2.10 Preserve day-click -> DayFocusDialog trigger
- [x] 2.11 Run build

## 3. Powered Today-Only + Soft-Delete Archive

- [x] 3.1 Add `archivedAt?: string` to `OhmCard` in `src/types/board.ts`
- [x] 3.2 Add archive prune to `sanitizeBoard()` in `src/utils/storage.ts`: delete cards with `archivedAt` >14 days, strip `archivedAt` from non-Powered cards
- [x] 3.3 Add `dailyLimit` migration to `sanitizeBoard()`: default to 3 if missing
- [x] 3.4 Add `funSettings` migration to `sanitizeBoard()`: default to `{}` if missing/non-object
- [x] 3.5 Replace hard-delete archive in Board.tsx useEffect with soft-delete: set `archivedAt` on yesterday's Powered cards instead of `deleteCards()`
- [x] 3.6 Filter archived cards from all rendering (Board column cards, capacity counts, filter results)
- [x] 3.7 Update Powered column to show today-only cards (no date grouping)
- [x] 3.8 Add/update tests for sanitizeBoard migration steps and archive filtering
- [x] 3.9 Run build

## 4. Expanded Card Layout

- [ ] 4.1 Create expanded card variant for Live/Powered: larger title, description preview (2-3 lines), interactive task checklist
- [ ] 4.2 Add column-aware card sizing: expanded in Live/Powered, compact in Charging/Grounded
- [ ] 4.3 Task checklist: interactive toggles in Live, read-only in Powered
- [ ] 4.4 Verify compact card layout unchanged in Charging/Grounded (energy badge, category pill, task preview, stale indicator)
- [ ] 4.5 Run build

## 5. What's Ahead Summary

- [ ] 5.1 Create WhatsAhead component: category count chips from Charging + Grounded cards
- [ ] 5.2 Desktop: render in grid header slot (cols 3-4, `grid-column: span 2`)
- [ ] 5.3 Mobile: render as section divider between Live and Charging
- [ ] 5.4 Handle uncategorized cards (omit or show as "other")
- [ ] 5.5 Add scrollable overflow for mobile chip row
- [ ] 5.6 Run build

## 6. DayFocusDialog Redesign

- [ ] 6.1 Replace energy ratio display with mini 3-segment meter per day (item count vs `dailyLimit`)
- [ ] 6.2 Add energy tinting to mini-meter segments
- [ ] 6.3 Update `availableDates` to source from 14-day forward window (not BudgetBar rolling window)
- [ ] 6.4 Verify navigation (arrows + swipe), reschedule actions, and drag-and-drop reorder still work
- [ ] 6.5 Run build

## 7. Daily Color Theme

- [ ] 7.1 Add `FunSettings` interface to `src/types/board.ts`: `{ dailyTheme?: boolean; darkSoulsMessages?: boolean }`
- [ ] 7.2 Add `funSettings?: FunSettings` to `OhmBoard`
- [ ] 7.3 Implement `dailyHue(date)` utility: golden-ratio step `(dayIndex * 137.508) % 360`
- [ ] 7.4 When `funSettings.dailyTheme` is true: shift `--color-ohm-spark` to daily hue, blend column header tints
- [ ] 7.5 Verify background/text colors stay fixed for readability
- [ ] 7.6 Run build

## 8. Settings Cleanup

- [ ] 8.1 Remove from Board tab: live capacity, total budget, auto-budget, window size controls
- [ ] 8.2 Add Daily limit spinner (1-5, default 3) to Board tab
- [ ] 8.3 Create Fun tab with daily color theme toggle
- [ ] 8.4 Add storage usage display to Data tab: `navigator.storage.estimate()` bar, localStorage estimate, Drive quota when connected
- [ ] 8.5 Run build

## 9. Documentation Overhaul

- [ ] 9.1 Update README.md: column table, philosophy, features list, standards alignment tables
- [ ] 9.2 Update CLAUDE.md: architecture notes, capacity system, new/adapted components, remove old references
- [ ] 9.3 Update todo.md: remove completed redesign items, add new items surfaced during implementation
- [ ] 9.4 Archive or replace redesign doc with living spec (ties into OpenSpec adoption)
