# Changelog

All notable changes to the **Recipe Visualizer** extension are documented here.

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
