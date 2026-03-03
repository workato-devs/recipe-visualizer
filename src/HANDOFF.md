# Recipe Visualizer - Handoff Document

**Date:** January 30, 2026
**Status:** v0.4.0 Complete - Swim lane layout, standardized node sizing, debug tools

---

## What This Is

A VS Code extension that visualizes Workato recipe JSON files as interactive workflow graphs. Recipes are nested JSON structures with control flow (`try/catch`, `if/else`) and actions (Salesforce, Stripe, etc.). The visualizer converts these to a graph model and renders them using React Flow.

**Compatible with:** VS Code, Cursor, Windsurf (any VS Code fork)

---

## What's Been Built

### Core Transformer (`core/transformer.ts`)
- Converts Workato recipe JSON → **IGM (Intermediate Graph Model)**
- Handles: `trigger`, `action`, `if/else`, `try/catch`, `foreach`
- Creates virtual nodes: `branch` (Then/Else), `join` (only when needed), `end`
- Smart join elimination: skips join nodes when only one branch continues
- Extracts recipe metadata (name, version, connections)
- Extracts step-level data: input/output schemas, connection names, step inputs
- **26 passing tests** in `core/transformer.test.ts`

### Webview UI (`webview-ui/`)
- **React Flow** for graph rendering
- **ELK layout engine** (elkjs) for professional orthogonal edge routing
- **Layout direction toggle** - switch between left-to-right and top-to-bottom
- **Enhanced node details panel** with:
  - Step metadata (provider, action, UUID, etc.)
  - Connection name (when applicable)
  - Input/output schema preview (expandable, type-colored)
  - Step input values (with datapill simplification)
  - "Go to code" navigation button
- Custom node components with proper visual hierarchy:
  - **Action nodes**: Large, prominent (the main content)
  - **Terminal nodes**: Show HTTP status codes (200, 404, etc.)
  - **Control flow**: Small pills (try, catch, if, foreach, join, end)
- Custom edge types:
  - **LoopBackEdge**: Routes loop-back edges around nodes with smooth corners
  - Edge labels: "yes"/"no" for conditionals, "error" for catch, "repeat"/"exit" for loops
- Demo mode with fixture switching for development

### Extension (`extension/`)
- `extension.ts` - Entry point, commands, file watchers
- `RecipeVisualizerPanel.ts` - Webview panel management with focus tracking
- `jsonPointer.ts` - JSON Pointer ↔ editor position conversion (uses `jsonc-parser`)
- **Click-to-select model** - Click shows details, explicit button navigates to code
- **Editor → Graph sync** - Moving cursor in editor highlights corresponding node (only when editor is focused)

---

## v0.2.0 Changes (January 26, 2026)

| Feature | Description |
|---------|-------------|
| **Click model refactor** | Click-to-select: clicking node shows details only, "→ Code" button navigates |
| **Focus-based sync** | Editor→webview selection sync only when editor is focused (no feedback loops) |
| **Schema preview** | Expandable input/output schema with field names, types, required markers |
| **Connection display** | Shows connection name (e.g., "SF Dev Account") when step uses named connection |
| **Step inputs** | Displays key input values with datapill simplification |
| **TypeScript cleanup** | Fixed type inference issues, proper generics for React Flow hooks |
| **Archived /codex** | Preserved ADRs and specs from /codex workstream in `docs/archive-codex/` |

---

## v0.3.5 Changes (January 28, 2026)

| Feature | Description |
|---------|-------------|
| **Step numbers on nodes** | Circular badge (top-left) displays step number for sequencing visibility |
| **Auto-close on file close** | Visualization panel closes when source recipe file is closed |
| **Join nodes removed** | Synthetic join nodes eliminated - branches connect directly to next step |
| **Expanded provider mappings** | 50+ providers (Slack, AWS, databases, etc.), new trigger types (polling, event) |
| **Fallback title-casing** | Unknown providers auto-formatted (e.g., `my_api` → "My Api") |

---

## v0.3.0 Changes (January 26, 2026)

| Feature | Description |
|---------|-------------|
| **Foreach loop support** | Parse and visualize `foreach` blocks with loop/exit edges |
| **Exit edge kind** | New "exit" edge type for leaving loops, styled with solid purple |
| **Loop-back edge routing** | Custom `LoopBackEdge` component routes around nodes with smooth corners |
| **Smart join elimination** | Join nodes only created when multiple branches converge (cleaner graphs) |
| **If-without-else cleanup** | No join nodes for if statements without else; false edge goes to next step |
| **Cross-recipe drill-down** | Click "Open recipe" on `call_recipe` nodes to open called recipe in new visualizer |
| **Recipe call detection** | Fixed detection (`call_recipe` not `call`), extracts `recipeCallRef` metadata |
| **Visual polish** | Node hover effects, transitions, recipe call styling, panel animations |
| **Recipe call nodes** | Green border/glow, ↗ icon, shows target recipe name |
| **Details panel** | Slide-in animation, custom scrollbar, "Open recipe" button for drill-down |

---

## Project Structure

```
src/
├── core/
│   ├── transformer.ts       # JSON → IGM conversion (main logic)
│   ├── transformer.test.ts  # 24 tests
│   └── demo.ts              # CLI tool to inspect IGM output
├── shared/
│   ├── types.ts             # IGM TypeScript types (SchemaField, StepMeta, etc.)
│   └── messages.ts          # Extension ↔ Webview message protocol
├── extension/
│   ├── extension.ts         # VS Code extension entry point
│   ├── RecipeVisualizerPanel.ts  # Webview panel class with focus tracking
│   └── jsonPointer.ts       # Source navigation (jsonc-parser)
├── webview-ui/
│   ├── src/
│   │   ├── main.tsx         # React entry point
│   │   ├── App.tsx          # Main component, React Flow setup
│   │   ├── useLayout.ts     # ELK layout (async, supports direction)
│   │   ├── NodeDetailsPanel.tsx  # Enhanced details panel
│   │   ├── nodes/index.tsx  # Custom node components
│   │   ├── edges/           # Custom edge components
│   │   │   ├── index.tsx    # Edge type registry
│   │   │   └── LoopBackEdge.tsx  # Loop-back edge with smooth routing
│   │   └── styles.css       # VS Code themed styles
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
├── fixtures/
│   ├── upsert_contact.recipe.json      # Simple: try/catch
│   ├── ha_api_control_light.recipe.json # Complex: nested if/else
│   └── search_rooms_foreach.recipe.json # Loop: foreach with try/catch
├── docs/
│   ├── igm-spec.md          # Authoritative IGM specification (v1.2)
│   └── archive/             # Historical ADRs, specs, session notes
│       ├── README.md        # Archive index
│       ├── adr/             # Architecture Decision Records (7 files)
│       ├── specs/           # Superseded IGM schema specs
│       └── security/        # CSP baseline documentation
├── dist/                    # Build output
│   ├── extension.js         # Bundled extension (~58KB)
│   └── webview/             # Bundled webview (~1.85MB)
├── releases/                # Packaged .vsix extension files
├── .vscode/
│   ├── launch.json          # Debug configuration
│   └── tasks.json           # Build tasks
├── .vscodeignore            # Files excluded from package
├── package.json             # Extension manifest + scripts
├── tsconfig.json
└── HANDOFF.md               # This file
```

---

## How to Run

### Install Dependencies
```bash
cd src
npm install
```

### Development (standalone webview)
```bash
npm run dev:webview
# Open http://localhost:5173
# Use dropdown to switch between demo fixtures
```

### Build Extension
```bash
npm run build
# Builds both extension (esbuild) and webview (Vite)
```

### Package Extension
```bash
npm run package
# Creates releases/recipe-visualizer-X.X.X.vsix
```

### Install in VS Code / Cursor / Windsurf
```bash
windsurf --install-extension releases/recipe-visualizer-0.3.0.vsix
# or
code --install-extension releases/recipe-visualizer-0.3.0.vsix
# or
cursor --install-extension releases/recipe-visualizer-0.3.0.vsix
```

### Run Tests
```bash
npm test
# Runs 24 transformer tests
```

---

## Usage

1. Open a `.recipe.json` file in the editor
2. Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)
3. Or right-click → "Visualize Recipe"

**Interactions:**
- **Click node** → Shows details panel (no navigation)
- **Click "→ Code" button** → Navigates to source and focuses editor
- **Click L-R/T-B button** → Toggles layout direction
- **X button on panel** → Closes details panel
- **Zoom/pan** → Mouse wheel and drag
- **Cursor in editor** → Highlights corresponding node in graph (when editor focused)

---

## Click Model & Selection Sync

The extension uses a **click-to-select** model to avoid focus jumping:

```
┌─────────────────────────────────────────────────────────────┐
│  WEBVIEW ACTIVE                                             │
│  • Click node → details panel shows                         │
│  • Click "→ Code" → editor gets focus, cursor moves         │
│  • Editor selection sync: SKIPPED (webview owns selection)  │
└─────────────────────────────────────────────────────────────┘
                              ↓ focus shifts
┌─────────────────────────────────────────────────────────────┐
│  EDITOR ACTIVE                                              │
│  • Move cursor → graph highlights corresponding node        │
│  • Editor selection sync: ENABLED                           │
└─────────────────────────────────────────────────────────────┘
```

This is implemented via `_isActive` tracking in `RecipeVisualizerPanel.ts` using the `onDidChangeViewState` event.

---

## Details Panel Features

The node details panel shows contextual information based on node type:

### For All Nodes
- Node kind badge (trigger, action, if, try, catch, etc.)
- Node label

### For Action/Trigger Nodes
- **Provider badge** (e.g., "Salesforce.upsert_sobject")
- **Connection name** (e.g., "SF Dev Account") - if step uses a named connection
- **Step details**: keyword, provider, action, UUID, step number, output alias
- **Step inputs**: Key-value pairs with datapill simplification
  - `#{_dp('{...path:["parameters","email"]}')}` → `trigger.parameters.email`
- **Input/Output schema**: Expandable field list with types
  - Color-coded types (string=green, boolean=yellow, object=purple, etc.)
  - Required fields marked with red asterisk
  - Nested objects expandable up to 2 levels

### For Terminal Nodes
- HTTP status code badge (color-coded: 2xx=green, 4xx=orange, 5xx=red)

---

## Build Architecture

```
Source                    Build Output
─────────────────────────────────────────
extension/*.ts    ──►  dist/extension.js     (esbuild, CJS bundle)
core/*.ts         ──►  (bundled into above)
shared/*.ts       ──►  (bundled into above)
webview-ui/       ──►  dist/webview/         (Vite, browser bundle)
```

**Key bundling notes:**
- `jsonc-parser` must use ESM import path: `jsonc-parser/lib/esm/main.js`
- Extension uses CommonJS format for VS Code compatibility
- Webview is a standard browser bundle

---

## v0.3.0 Backlog - COMPLETE

| # | Feature | Status |
|---|---------|--------|
| ✓ | **Loop visualization** | Foreach nodes, loop/exit edges, smart join elimination |
| ✓ | **Callable recipe input schema** | Parses `parameters_schema_json` and `result_schema_json` |
| ✓ | **Cross-recipe drill-down** | "Open recipe" button on call_recipe nodes |
| ✓ | **Visual polish** | Animations, transitions, recipe call styling, panel slide-in |

---

## v0.4.0 Changes (January 30, 2026)

| Feature | Description |
|---------|-------------|
| **Swim lane layout** | Try/catch and if/else branches visually separated on Y-axis (success path above, error path below) |
| **MrTree algorithm** | Switched to MrTree for more compact, consistent layouts |
| **Post-layout partition adjustment** | Nodes shifted up/down based on partition (P1=-80px, P2=+80px) |
| **Standardized node sizing** | Two-tier system: main nodes (70px height), control nodes (30px height) |
| **Direction-aware layout** | Swim lanes work in both horizontal (Y separation) and vertical (X separation) modes |
| **::end node fix** | End node now consistently placed at logical end of graph |
| **Debug tools isolated** | Debug panel, snapshots, partition overlay moved to dev-only module (not shipped in production) |

### Swim Lane Implementation Details

The layout now uses a partition-based system:
- **Partition 0** (center): Main flow axis - triggers, control nodes (try/if), joins
- **Partition 1** (upper/success): Try body actions, "then" branch actions
- **Partition 2** (lower/error): Catch body actions, "else" branch actions

Layout process:
1. ELK MrTree algorithm provides base layout
2. Post-layout adjustment shifts P1 nodes up (-80px) and P2 nodes down (+80px)
3. End node repositioned to rightmost/bottommost position

### Debug Tools (Dev Only)

Available when running `npm run dev:webview`:
- **Debug toggle** (bottom-right): Enable/disable debug mode
- **Partition overlay**: Colored swim lane bands showing P0/P1/P2 regions
- **Layout controls**: Algorithm selection, offset sliders, ELK partitioning toggle
- **Snapshot system**: Save/export layout configurations for analysis
- **Node positions table**: Real-time X, Y, partition values

---

## v0.5.0 Backlog

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| 1 | **Conditional node UI** | Medium | Show logic context on if/try nodes - either in detail panel on click, or show positive/negative conditions directly on nodes. Currently "if → yes/no" provides no information about what condition is being evaluated. |

### Deferred / Low Priority
| Feature | Notes |
|---------|-------|
| Node-level warnings | Design scheme for which config issues (blank required fields, etc.) should surface on graph nodes vs. only in detail panel |
| Collapsible sections | Collapse try/catch, if/else blocks - complex to implement, unclear value |
| Keyboard navigation | Arrow keys between nodes - may not be useful |
| Data edges | Visualize datapill dependencies - may add too much noise in large recipes |

---

## Future Enhancements (v4+)

### From Archived /codex Specs
| Feature | Reference |
|---------|-----------|
| **Generic JSON visualization** | `docs/archive/specs/igm-spec-v2-merged.md` |
| **Array virtualization** | `docs/archive/adr/adr-0004-array-expansion-ux.md` |
| **Annotation storage** | `docs/archive/adr/adr-0005-annotation-storage.md` |

---

## Test Fixtures

| Fixture | Features | Nodes | Edges |
|---------|----------|-------|-------|
| `upsert_contact.recipe.json` | Callable trigger, try/catch, terminal return, SF connection | 7 | 7 |
| `ha_api_control_light.recipe.json` | API trigger, nested if/else (3 levels), 5 HTTP status terminals | 22 | 25 |
| `search_rooms_foreach.recipe.json` | API trigger, foreach loop inside try/catch, exit edge | 9 | 10 |
| `order_processing_with_calls.recipe.json` | API trigger, 4 recipe calls, nested if/else, try/catch | - | - |
| `create_booking_orchestrator.recipe.json` | Real orchestrator with 7+ recipe calls, complex nesting | 34 | 41 |

---

## Dependencies

```json
{
  "dependencies": {
    "@xyflow/react": "^12.0.0",
    "elkjs": "^0.11.0",
    "jsonc-parser": "^3.3.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vscode/vsce": "^3.0.0",
    "esbuild": "^0.20.0",
    "vite": "^5.0.12",
    "typescript": "^5.3.3"
  }
}
```

---

## Reference Documents

- `docs/igm-spec.md` — Full IGM specification
- `shared/types.ts` — TypeScript type definitions
- `docs/archive/` — Archived ADRs and specs

---

## Session Notes

See [docs/archive/session-notes.md](docs/archive/session-notes.md) for full development session logs (v0.1.0 through v0.4.0).
