# Recipe Visualizer

Turn [Workato](https://www.workato.com/) recipe JSON into interactive workflow graphs. See your
automation logic as a visual DAG — with click-to-inspect nodes, editor navigation, and support for
complex control flow.

**Compatible with:** VS Code, Cursor, Windsurf (any VS Code fork)

---

## Features

- **Visual workflow graphs** — nested recipe JSON rendered as clean, directed graphs with orthogonal edge routing
- **Full control flow** — `if/else`, `try/catch`, `foreach` loops, and cross-recipe calls visualized with swim-lane layout
- **Click-to-inspect** — select any node to see its metadata, input/output schemas, connection info, and step inputs
- **Editor navigation** — "Go to Code" jumps from a graph node to the exact line in your JSON editor
- **Cursor sync** — moving your cursor in the editor highlights the corresponding node in the graph
- **Layout toggle** — switch between left-to-right and top-to-bottom layout directions
- **Cross-recipe drill-down** — `call_recipe` nodes open the target recipe in a new visualizer panel

---

## Installation

Install from the **VS Code Marketplace** or **Open VSX**: search for **"Recipe Visualizer"**
(by WorkatoLabs) and click **Install**.

Or install a `.vsix` directly:

```bash
code --install-extension recipe-visualizer-<version>.vsix
```

Replace `code` with `cursor` or `windsurf` as needed.

---

## Usage

1. Open a `.recipe.json` file in the editor
2. Press **Cmd+Shift+V** (Mac) / **Ctrl+Shift+V** (Windows/Linux)
3. Or click the **preview icon** in the editor title bar
4. Or right-click the file → **"Visualize Recipe"**

| Interaction | What happens |
|---|---|
| Click a node | Opens the details panel with schemas, metadata, and step inputs |
| Click "→ Code" | Navigates to the source JSON and focuses the editor |
| Click L-R / T-B | Toggles layout direction |
| Move cursor in editor | Highlights the corresponding graph node |

---

## Development (for contributors)

These steps are for building or modifying the extension itself — **not** needed to use it.

```bash
cd src
npm install

npm run dev:webview   # Standalone webview at http://localhost:5173 (switch demo fixtures via dropdown)
npm run build         # Build extension + webview
npm run package       # Create releases/recipe-visualizer-<version>.vsix
npm test              # Run transformer tests
```

The IGM (Intermediate Graph Model) specification lives in
[`docs/igm-spec.md`](docs/igm-spec.md). For source, issues, and contribution guidelines, see the
[GitHub repository](https://github.com/workato-devs/recipe-visualizer).

---

## License

[MIT](LICENSE.md)
