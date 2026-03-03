# Archived Documentation

This directory contains historical documentation: superseded decisions, completed feature specs, and development session notes from the Recipe Visualizer build process.

These files originated from the `/codex` prototype workstream and subsequent development under `/claude`. They are preserved for historical context, future feature reference, and design rationale.

---

## Architecture Decision Records

| ADR | Status | Description |
|-----|--------|-------------|
| [adr-0001](adr/adr-0001-renderer-choice.md) | Superseded | Renderer choice: Cytoscape.js → React Flow |
| [adr-0002](adr/adr-0002-layout-engine-choice.md) | Updated | ELK layout engine (integration changed for React Flow) |
| [adr-0003](adr/adr-0003-deterministic-ids.md) | Implemented | Deterministic node/edge IDs via UUID or JSON Pointer |
| [adr-0004](adr/adr-0004-array-expansion-ux.md) | Future | Array virtualization for large datasets |
| [adr-0005](adr/adr-0005-annotation-storage.md) | Future | Sidecar file approach for user annotations |
| [adr-0006](adr/adr-0006-swim-lane-layout.md) | Implemented | Partition-based swim lane layout with MrTree |
| [adr-0007](adr/adr-0007-join-node-elimination.md) | Implemented | Removal of synthetic join nodes from IGM |

## Specs

| File | Description |
|------|-------------|
| [igm-spec-v2-merged.md](specs/igm-spec-v2-merged.md) | Dual-mode spec: Workato recipes + generic JSON visualization |
| [igm-spec-v2-addendum.md](specs/igm-spec-v2-addendum.md) | Array, group, and collapse semantics for future features |

## Security

| File | Description |
|------|-------------|
| [webview-csp-message-protocol-baseline.md](security/webview-csp-message-protocol-baseline.md) | CSP requirements and message protocol security model |

## Other

| File | Description |
|------|-------------|
| [igm-spec-compliance-checklist.md](igm-spec-compliance-checklist.md) | 17-requirement compliance matrix for IGM spec |
| [igm-spec-v1.md](igm-spec-v1.md) | Superseded IGM specification (v1.1) |
| [session-notes.md](session-notes.md) | Development session logs (extracted from HANDOFF.md) |
