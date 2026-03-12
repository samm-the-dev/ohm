# OHM

**A personal kanban for ADHD brains -- manage the current.**

OHM uses an electrical metaphor to map ADHD energy cycles into a visual workflow.

| Column       | Metaphor           | Purpose                                |
| ------------ | ------------------ | -------------------------------------- |
| **Charging** | Building energy    | Captured ideas shaped with a next step |
| **Live**     | Hot/active circuit | Currently working (WIP limited)        |
| **Grounded** | Safely discharged  | Paused with "where I left off" context |
| **Powered**  | Circuit complete   | Done                                   |

## Philosophy

- **Capture fast** -- Quick Spark captures a title plus optional details. Think later.
- **Always know what's next** -- Every card has a "Next Step" field with a nudge when missing.
- **Don't abandon, ground** -- Moving to Grounded prompts you to leave context for future you.
- **Match energy to tasks** -- Energy tags (Quick Win / Medium / Deep Focus) let you filter by current state.
- **Limit WIP** -- Per-column energy capacity prevents overcommitting during hyperfocus bursts.
- **Contextual UI** -- Only relevant fields and status transitions are shown per card state.

## Features

- **Drag-and-drop reordering** within columns via dnd-kit (touch + pointer)
- **Per-column capacity** with energy-weighted limits (Small=1, Med=2, Large=3 segments)
- **Aging indicators** -- cards untouched for 14+ days fade to surface stale work
- **Completion flash** -- green pulse on the Powered column when a card arrives
- **Welcome-back summary** -- re-engagement banner after 24+ hours away
- **Maskable icon** -- safe-zone-compliant icon for adaptive launchers
- **Google Drive sync** -- optional cross-device persistence via app data storage
- **Energy/category/search filtering** with mobile-friendly collapsible filter bar
- **Installable PWA** with offline support

## Standards Alignment

Ohm's design is grounded in established kanban methodology and ADHD productivity research.

### Kanban Method

Based on the six core practices from the [Kanban Guide](https://kanban.university/kanban-guide/) (David Anderson, Andy Carmichael) and [Personal Kanban](https://www.personalkanban.com/) (Jim Benson):

| Practice                    | Implementation                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Visualize work**          | Four-column board with energy tags and drag-and-drop prioritization                        |
| **Limit WIP**               | Per-column energy capacity with green-to-red gradient indicators                           |
| **Manage flow**             | Aging indicators surface stale cards; contextual status transitions prevent skipping steps |
| **Make policies explicit**  | NextStep nudge on Live transition; "Where I Left Off" prompt on Grounded                   |
| **Feedback loops**          | Completion flash, welcome-back summary for ambient awareness                               |
| **Improve collaboratively** | Single-user tool -- N/A by design                                                          |

### ADHD Productivity Research

| Challenge                           | Feature                                         | Basis                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task paralysis from unbounded lists | Per-column capacity limits                      | [Effective Task Management for ADHD](https://leantime.io/effective-task-management-techniques-adhd/)                                                                                                                   |
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
