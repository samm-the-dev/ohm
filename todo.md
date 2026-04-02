# Todo

- [x] Review refactor plan (energy orchestrator evolution, companion apps, shared-origin ecosystem) -- see [docs/](docs/)
- [x] Add testing (Vitest + React Testing Library; hooks, board-utils, component interactions)
- [x] Card archive (auto-archive expired Powered cards in rolling window)
- [x] Day budget focus dialog (click on day budget meter to pop a day focus view)
- [x] Today-focus redesign (column reorder, item-count BudgetBar, soft-delete archive, expanded cards, DayFocusDialog mini-meters) -- see [openspec/](openspec/changes/today-focus-redesign/)
- [ ] Migrate inline `handleShare` in Board.tsx to use `.toolbox/lib/share.ts` (wrap with toasts)
- [ ] Cross-column drag-and-drop (currently DnD is reorder-only within same column)
- [ ] Keyboard shortcuts
- [ ] Task completion state (tasks as `{text, done}` for interactive checklists in expanded cards)
- [ ] Analytics (completion rates, time-in-column trends -- soft-delete archive preserves data)
- [ ] Daily color theme (golden-ratio hue rotation, fun settings toggle)
- [ ] Dark Souls messages (separate OpenSpec change)
- [ ] Storage usage display in Settings Data tab
- [ ] Red-green colorblind mode (deuteranopia-safe palette for energy/status colors)
- [ ] A11y test fixtures (axe-core + Playwright automated audits -- pair with colorblind mode work)
- [ ] Powered column glow (ambient header glow based on trailing completion ratio -- explore design)
- [ ] Budget bar click-through when dialogs are open (pointer-events-auto + onInteractOutside to prevent dismiss)
- [ ] Snap-aware drawer scroll height (SnapContext passing active snap fraction to Content for dynamic height)

- [ ] Run OHM through BMAD workflow (product brief, PRD, tech spec) -- phase 2 of methodology adoption, post-redesign
