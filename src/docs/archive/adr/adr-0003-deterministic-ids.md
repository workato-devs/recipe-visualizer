# ADR 0003: Deterministic ID Strategy

Status: Accepted (Implemented)

> **Note (2026-01):** This ADR is fully implemented in the consolidated extension under /claude. The ID strategy is used in `core/transformer.ts`.

## Context
Stable node and edge IDs are required for layout stability, diffs, and selection syncing between editor and webview.

## Decision
- Node IDs: use `step.uuid` when available, otherwise `ptr:<jsonPointer>`.
- Virtual nodes: derive from parent IDs (`::then`, `::else`, `::join`, `::catch`).
- End node: `::end`.
- Edge IDs: `${kind}|${from}|${to}`.

## Implementation
The `buildIgm()` function in `core/transformer.ts` implements this strategy:
- Extracts `uuid` from step metadata when present.
- Falls back to JSON Pointer-based IDs for steps without UUIDs.
- Virtual nodes (branch, join, end) use the `::` prefix convention.
- Edge IDs combine kind, source, and target for uniqueness.

## Consequences
- IDs are deterministic across runs and consistent with JSON Pointer mapping.
- Pointer-derived IDs can change if the source JSON shifts or is reformatted.
- UUID-based IDs are preferred for accurate source navigation.

## Alternatives Considered
- Hash of JSON Pointer + kind: Stable but obscures traceability.
- UUID generation at runtime: Not deterministic across sessions.
