# Changelog

All notable changes to the **Recipe Visualizer** extension are documented here.

## 1.1.0

### Fixed

- **Repeat while loops** — `repeat` steps now render as a loop container (like `foreach`) with their inner steps,
  instead of a single "Unknown keyword: repeat" error node. The details panel shows the loop's max iterations and
  repeat condition when present. ([#4](https://github.com/workato-devs/recipe-visualizer/issues/4))
- **Async recipe calls** — `call_recipe_async` (and other `call_recipe*` variants) are recognized as recipe calls and
  support drill-down. ([#3](https://github.com/workato-devs/recipe-visualizer/issues/3))
- **Recipe calls by ID** — when `flow_id` is a bare recipe ID (e.g. a recipe pulled on its own with
  `wk recipes pull <id>`), drill-down looks up the called recipe by name in the workspace, and shows a clearer
  message if it isn't there. ([#3](https://github.com/workato-devs/recipe-visualizer/issues/3))
- **Unknown step types** — steps with an unrecognized keyword still show an error node, but their inner steps are
  now drawn instead of dropped.
- **Loops at the end of a block** — a `foreach` or `repeat` loop that is the last step in its block (or recipe) now
  gets an exit edge to End instead of appearing to have no way out.

## 1.0.0

First public release on the VS Code Marketplace and Open VSX.

- **Visual workflow graphs** — nested recipe JSON rendered as clean, directed graphs with orthogonal edge routing
- **Full control flow** — `if/else`, `try/catch`, `foreach` loops, and cross-recipe calls visualized with swim-lane layout
- **Click-to-inspect** — select any node to see its metadata, input/output schemas, connection info, and step inputs
- **Editor navigation** — "Go to Code" jumps from a graph node to the exact line in the JSON editor
- **Cursor sync** — moving the cursor in the editor highlights the corresponding node in the graph
- **Layout toggle** — switch between left-to-right and top-to-bottom layout directions
- **Cross-recipe drill-down** — `call_recipe` nodes open the target recipe in a new visualizer panel
- Works in VS Code, Cursor, Windsurf, and other VS Code forks

### Pre-1.0 development

Versions 0.1.0–0.5.x were internal beta builds. Highlights leading up to 1.0.0 include expanded
IGM type coverage, support for stop/return steps, Genie triggers and pub/sub connectors,
multi-tab focus handling, and a broader golden-recipe test corpus.
