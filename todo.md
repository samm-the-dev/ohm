# Todo

- [x] Review refactor plan (energy orchestrator evolution, companion apps, shared-origin ecosystem) -- see [docs/](docs/)
- [x] Add testing (Vitest + React Testing Library; hooks, board-utils, component interactions)
- [x] Card archive (auto-archive expired Powered cards in rolling window)
- [ ] Migrate inline `handleShare` in Board.tsx to use `.toolbox/lib/share.ts` (wrap with toasts)
- [ ] Cross-column drag-and-drop (currently DnD is reorder-only within same column)
- [ ] Keyboard shortcuts
- [ ] Analytics (completion rates, time-in-column trends)
- [ ] Red-green colorblind mode (deuteranopia-safe palette for energy/status colors)
- [ ] A11y test fixtures (axe-core + Playwright automated audits -- pair with colorblind mode work)
- [ ] Powered column glow (ambient header glow based on trailing completion ratio -- explore design)
- [x] Day budget focus dialog (click on day budget meter to pop a day focus view)
