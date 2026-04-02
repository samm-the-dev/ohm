# OHM

**A personal kanban for ADHD brains -- manage the current.**

OHM uses an electrical metaphor to map ADHD energy cycles into a visual workflow. Columns are ordered **present to future** -- wins first.

| Column       | Metaphor           | Purpose                         |
| ------------ | ------------------ | ------------------------------- |
| **Powered**  | Circuit complete   | Done today (trophy case)        |
| **Live**     | Hot/active circuit | Currently working (daily limit) |
| **Charging** | Building energy    | Scheduled ahead (future dates)  |
| **Grounded** | Safely discharged  | Unscheduled backlog             |

## Philosophy

- **Capture fast** -- Quick Spark captures a title plus optional details. Think later.
- **Always know what's next** -- Every card has a "Next Step" field with a nudge when missing.
- **Don't abandon, ground** -- Moving to Grounded prompts you to leave context for future you.
- **Match energy to tasks** -- Energy tags let you filter by current capacity.
- **Limit WIP** -- Flat daily item limit (default 3) prevents overcommitting during hyperfocus bursts.
- **Contextual UI** -- Only relevant fields and status transitions are shown per card state.

## Features

- **Today-focused board** -- columns ordered present to future, completed wins lead
- **Daily item limit** (configurable 1-5) with visual pip meter and energy tinting
- **Drag-and-drop reordering** within columns via dnd-kit (touch + pointer)
- **Expanded cards** in Live/Powered with description preview and full task list
- **Budget bar** -- schedule window with item-count pips, energy-tinted by card weight
- **Day focus dialog** -- forward-looking mini-planner with pip meters per day
- **Soft-delete archive** -- completed cards retained 14 days for future analytics
- **Aging indicators** -- cards untouched for 14+ days fade to surface stale work
- **Completion flash** -- green pulse on the Powered column when a card arrives
- **Welcome-back summary** -- re-engagement banner after 24+ hours away
- **Google Drive sync** -- optional cross-device persistence via app data storage
- **Energy/category/date/search filtering** with mobile-friendly collapsible filter bar
- **Installable PWA** with offline support and maskable icon

## Standards Alignment

Ohm's design is grounded in established kanban methodology and ADHD productivity research.

### Kanban Method

Based on the six core practices from the [Kanban Guide](https://kanban.university/kanban-guide/) (David Anderson, Andy Carmichael) and [Personal Kanban](https://www.personalkanban.com/) (Jim Benson):

| Practice                    | Implementation                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Visualize work**          | Four-column board with energy tags, pip meters, and drag-and-drop prioritization           |
| **Limit WIP**               | Flat daily item limit (default 3) with visual pip indicator                                |
| **Manage flow**             | Aging indicators surface stale cards; contextual status transitions prevent skipping steps |
| **Make policies explicit**  | NextStep nudge on Live transition; "Where I Left Off" prompt on Grounded                   |
| **Feedback loops**          | Completion flash, welcome-back summary for ambient awareness                               |
| **Improve collaboratively** | Single-user tool -- N/A by design                                                          |

### ADHD Productivity Research

| Challenge                           | Feature                                         | Basis                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task paralysis from unbounded lists | Daily 3-item limit with visual pip meter        | [Effective Task Management for ADHD](https://leantime.io/effective-task-management-techniques-adhd/)                                                                                                                   |
| Time blindness                      | Aging indicators (14-day fade)                  | [Time Management with ADHD](https://www.endeavorotc.com/blog/how-to-manage-your-time-with-adhd-using-proven-techniques/)                                                                                               |
| Working memory deficits             | NextStep nudge, "Where I Left Off" context      | [Working Memory and ADHD](https://pmc.ncbi.nlm.nih.gov/articles/PMC5729117/)                                                                                                                                           |
| Reward deficiency                   | Completion flash, powered column celebration    | [ADHD Productivity: Evidence-Based Strategies](https://www.brain.fm/blog/adhd-productivity-evidence-based-strategies)                                                                                                  |
| Tool abandonment                    | Welcome-back summary, PWA re-engagement         | [Task Management Apps for Students with ADHD](https://pressbooks.pub/thealttext/chapter/effectiveness-and-challenges-of-task-management-apps-for-students-with-adhd-a-focus-on-task-organization-and-time-management/) |
| Executive function overload         | Energy tags, contextual UI, Quick Spark capture | [ADHD-Friendly Project Planning](https://www.memtime.com/blog/adhd-friendly-project-planning-and-task-management)                                                                                                      |

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS
- Vite + vite-plugin-pwa
- dnd-kit (drag-and-drop)
- localStorage + optional Google Drive sync
- GitHub Pages

## Getting Started

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
npm run deploy   # pushes to gh-pages branch
```

## License

MIT
