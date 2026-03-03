# Recipe Visualizer

A VS Code extension that visualizes Workato recipe JSON files as interactive workflow graphs. Recipes are nested JSON structures with control flow (`try/catch`, `if/else`, `foreach`) and actions (Salesforce, Stripe, etc.). The visualizer converts these to a graph model and renders them using React Flow.

**Version:** 0.4.2
**Compatible with:** VS Code, Cursor, Windsurf (any VS Code fork)

---

## Quick Start

```bash
cd src
npm install
```

### Development (standalone webview)
```bash
npm run dev:webview
# Open http://localhost:5173 — use dropdown to switch between demo fixtures
```

### Build & Package
```bash
npm run build       # Builds extension + webview
npm run package     # Creates releases/recipe-visualizer-X.X.X.vsix
```

### Install
```bash
code --install-extension releases/recipe-visualizer-0.4.2.vsix
# Also works with: cursor, windsurf
```

### Run Tests
```bash
npm test            # Runs transformer tests
```

---

## Usage

1. Open a `.recipe.json` file in the editor
2. Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)
3. Or right-click → "Visualize Recipe"

**Interactions:**
- **Click node** → Shows details panel
- **Click "→ Code"** → Navigates to source and focuses editor
- **Click L-R/T-B** → Toggles layout direction
- **Cursor in editor** → Highlights corresponding node (when editor focused)

---

## Project Structure

```
src/
├── core/               # JSON → IGM transformer + tests
├── shared/             # IGM types + extension↔webview messages
├── extension/          # VS Code extension entry point + panel
├── webview-ui/         # React Flow renderer + custom nodes/edges
├── fixtures/           # Test recipe JSON files
├── specs/              # Active feature design specs
├── docs/
│   ├── igm-spec.md     # Authoritative IGM specification (v1.2)
│   └── archive/        # Historical ADRs, specs, session notes
├── dist/               # Build output
└── releases/           # Packaged .vsix files
```

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [HANDOFF.md](HANDOFF.md) | Deep-dive reference: architecture, features, build system |
| [docs/igm-spec.md](docs/igm-spec.md) | Authoritative IGM schema and mapping rules (v1.2) |
| [specs/compound-nodes.md](specs/compound-nodes.md) | Active draft: hierarchical layout with compound nodes |
| [specs/schema-values-display.md](specs/schema-values-display.md) | Implemented: schema values in details panel |
| [docs/archive/](docs/archive/) | Historical ADRs, superseded specs, session notes |

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v0.4.0 | Jan 30 | Swim lane layout, MrTree algorithm, standardized node sizing, debug tools |
| v0.3.5 | Jan 28 | Step numbers, join node elimination, 50+ provider mappings |
| v0.3.0 | Jan 26 | Foreach loops, cross-recipe drill-down, smart join elimination |
| v0.2.0 | Jan 26 | Click-to-select model, schema preview, connection display, step inputs |
| v0.1.0 | Jan 22 | Initial build: React Flow + ELK layout, details panel, source navigation |
