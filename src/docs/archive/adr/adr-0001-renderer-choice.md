# ADR 0001: Renderer Choice

Status: Accepted (Superseded)

> **Note (2026-01):** This ADR was originally written for the /codex prototype which used Cytoscape.js. The consolidated extension under /claude uses React Flow instead. This document is preserved for historical context; see the updated decision below.

## Context
We need a webview renderer for the IGM graph that supports node selection, collapsible groups, and stable layout while keeping dependencies modest and compatible with VS Code-family webviews.

## Original Decision (Codex Prototype)
Use Cytoscape.js for v1 rendering.

## Revised Decision (Consolidated Extension)
Use React Flow (@xyflow/react) for production rendering.

## Rationale for Change
- React Flow provides a mature component model with custom node types, enabling rich workflow-card styling without extensive CSS workarounds.
- The React-based architecture integrates cleanly with Vite for webview bundling and hot reload during development.
- Custom node components (TriggerNode, ActionNode, ControlNode, etc.) provide better visual hierarchy than Cytoscape's CSS-only styling.
- Built-in support for handles, connection validation, and interactive features reduces custom code.
- The React ecosystem offers better tooling for the details panel and future UI enhancements.

## Consequences
- Adds React runtime (~40KB gzipped) to the webview bundle.
- Node styling is done via React components rather than CSS selectors.
- Layout is computed externally (ELK) and applied via node positions, which React Flow handles natively.

## Alternatives Considered
- Cytoscape.js: Used in /codex prototype; efficient for large graphs but required more custom styling work for workflow-card aesthetics.
- Custom canvas renderer: Smaller footprint but prohibitive development cost.
