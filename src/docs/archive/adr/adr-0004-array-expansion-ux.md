# ADR 0004: Array Expansion UX

Status: Accepted (Not Yet Implemented)

> **Note (2026-01):** This ADR captures design intent for array virtualization in generic JSON visualization mode. This feature is not yet implemented in the consolidated extension, which currently focuses on Workato recipe visualization. Preserved for future reference.

## Context
The extension spec requires array collection/prototype semantics and an expansion mechanism for large arrays. The IGM must support virtualized ranges to keep graphs readable and performant.

## Decision
- Represent arrays with a collection node plus a prototype item node.
- Show the first N items (default 8), and summarize the remainder as a virtual range node.
- Expose an `expandArray` message to increase the visible count on demand.

## Rationale
- Keeps initial render small and legible.
- Preserves a representative schema via the prototype node.
- Supports progressive disclosure without losing determinism.

## Consequences
- Renderer must implement a UI affordance for expansion (e.g., "Show more" button).
- The extension host must rebuild or diff the graph on expansion.

## Future Implementation Notes
- Relevant when generic JSON structure visualization is added.
- Consider integrating with collapse/expand grouping (see v2-addendum spec).
- May require additional message types in the protocol.

## Alternatives Considered
- Full expansion by default: Poor performance and visual clutter on large arrays.
- No expansion: Hides important details in large arrays.
