# ADR 0005: Optional Annotation Storage

Status: Accepted (Not Yet Implemented)

> **Note (2026-01):** This ADR captures design intent for user/agent annotations. This feature is not yet implemented in the consolidated extension. Preserved for future reference.

## Context
Agent-assisted metadata can improve visualization (labels, tags, grouping hints) but must remain optional and offline-first.

## Decision
Store optional annotations in a sidecar file located next to the source JSON: `<source>.igm.json`.

## Rationale
- Easy to share and version with fixtures.
- Keeps source JSON unchanged.
- Works across VS Code and forks without relying on proprietary storage.

## Consequences
- Requires file watching for both the source JSON and the sidecar.
- Naming convention must be documented and conflict-free.

## Future Implementation Notes
- Consider merging sidecar annotations into IGM during graph building.
- May support annotations like: custom labels, grouping hints, hidden nodes, layout overrides.
- Should validate sidecar schema to prevent stale/invalid annotations.

## Alternatives Considered
- Workspace state only: Not shareable and not easily versioned.
- Embedded annotations inside JSON: Pollutes source and risks invalidation.
