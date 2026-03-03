# CLAUDE.md — Agent Onboarding

## Build & Test

```bash
cd src
npm install          # Install dependencies
npm run build        # Build extension + webview
npm test             # Run transformer tests (tsx core/transformer.test.ts)
npm run dev:webview  # Dev server at http://localhost:5173
npm run package      # Package .vsix to releases/
npm run lint         # ESLint
```

## Architecture

| Path | Role |
|------|------|
| `core/transformer.ts` | Converts Workato recipe JSON → IGM (Intermediate Graph Model) |
| `core/transformer.test.ts` | Transformer unit tests |
| `shared/types.ts` | IGM TypeScript types (IgmNode, IgmEdge, SchemaField, StepMeta) |
| `shared/messages.ts` | Extension ↔ Webview message protocol |
| `extension/extension.ts` | VS Code extension entry point, commands, file watchers |
| `extension/RecipeVisualizerPanel.ts` | Webview panel management, focus tracking |
| `extension/jsonPointer.ts` | JSON Pointer ↔ editor position (uses jsonc-parser) |
| `webview-ui/src/App.tsx` | Main React component, React Flow setup |
| `webview-ui/src/useLayout.ts` | ELK layout hook (MrTree algorithm, partition offsets) |
| `webview-ui/src/NodeDetailsPanel.tsx` | Node details panel (schemas, inputs, connections) |
| `webview-ui/src/nodes/index.tsx` | Custom node components (action, trigger, control, etc.) |
| `webview-ui/src/edges/` | Custom edge components (LoopBackEdge) |

## Key Conventions

- **IGM** = Intermediate Graph Model. The intermediate representation between recipe JSON and rendered graph.
- **Node kinds**: `trigger`, `action`, `branch`, `end`, `try`, `catch`, `foreach`, `terminal`
- **Edge kinds**: `flow`, `true`, `false`, `error`, `loop`, `exit`
- **Partitions**: P0 = main flow axis, P1 = upper/success lane, P2 = lower/error lane
- Node sizing: 70px height (action/trigger), 30px height (control flow pills)
- Layout: ELK MrTree with post-layout partition offset (-80px / +80px)
- Extension bundled with esbuild (CJS); webview bundled with Vite (browser ESM)

## Key Documents

- `docs/igm-spec.md` — Full IGM specification
- `HANDOFF.md` — Detailed feature reference and architecture
- `specs/` — Active feature design specs
- `docs/archive/` — Historical ADRs and superseded specs
