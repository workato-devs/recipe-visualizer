# ADR 0002: Layout Engine Choice

Status: Accepted (Updated)

> **Note (2026-01):** This ADR remains valid. ELK is used in the consolidated extension, but the integration method changed from cytoscape-elk plugin to direct ELK computation with React Flow positioning.

## Context
The renderer needs a left-to-right layered layout to emulate a workflow. Layout must be deterministic and offline-first, with minimal dependencies.

## Decision
Use ELK (elkjs) for layered layout with configurable direction (LR or TB), integrated via a custom React hook.

## Implementation (Consolidated Extension)
- Layout is computed in `webview-ui/src/useLayout.ts` using elkjs directly.
- ELK computes node positions, which are then applied to React Flow nodes.
- Supports direction toggle: horizontal (left-to-right) or vertical (top-to-bottom).
- Node dimensions are calculated per-type (actions larger, control nodes smaller).
- Layout options: NODE_SPACING=80, LAYER_SPACING=100.

## Rationale
- ELK produces high-quality layered layouts, especially for complex branching and nested control flow.
- Supports deterministic results with explicit layout options.
- Orthogonal edge routing provides clean, professional appearance.
- Direction toggle allows user preference for workflow orientation.

## Consequences
- ELK adds ~300KB to the webview bundle (acceptable for the layout quality).
- Layout computation is async; the hook manages loading state.
- Custom glue code required to map ELK output to React Flow positions.

## Alternatives Considered
- Dagre: Lighter footprint but lower layout quality on complex graphs with nested branches.
- cytoscape-elk plugin: Used in /codex prototype; not applicable with React Flow.
- No layout engine: Manual positioning is error-prone and inconsistent.
