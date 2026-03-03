# ADR 0006: Swim Lane Layout Strategy

Status: Accepted (Implemented v0.4.0)

## Context
Try/catch and if/else branches need visual separation on the Y-axis so users can distinguish success paths from error/else paths at a glance.

Several approaches were attempted:
- **Compound nodes** — reverted. ELK compound nodes didn't achieve full branch grouping; nested compound layouts broke edge routing.
- **ELK partitioning** — reverted. ELK's partition feature is designed for independent subgraphs, not connected branches within a single flow.
- **Layout algorithm evaluation** — tested layered, stress, force, and MrTree. Layered produced inconsistent vertical placement; stress and force were non-deterministic.

## Decision
Use a **partition-based post-layout Y adjustment** with the **MrTree** layout algorithm.

1. Assign each node a partition value during graph construction:
   - **P0** (center): triggers, control nodes (try/if), joins, end
   - **P1** (upper/success): try body actions, "then" branch actions
   - **P2** (lower/error): catch body actions, "else" branch actions
2. Run ELK MrTree to compute base positions.
3. Apply post-layout offset: P1 nodes shift -80px, P2 nodes shift +80px.
4. Reposition the ::end node to the rightmost/bottommost position.

## Rationale
- MrTree produces compact, consistent tree layouts suitable for workflow graphs.
- Simple numeric offset avoids fighting the layout engine — works with it, not against it.
- Direction-aware: in horizontal mode offsets apply to Y; in vertical mode to X.
- Standardized two-tier node sizing (70px main, 30px control) eliminates edge wobble.

## Consequences
- ADR-0002 (ELK choice) still holds; only the algorithm within ELK changed from layered to MrTree.
- Fixed offset values (-80/+80) may need tuning for deeply nested recipes.
- Debug tools (partition overlay, offset sliders) support iterating on offset values during development.

## Alternatives Considered
- ELK compound nodes: Full branch grouping, but broke edge routing and required complex configuration.
- ELK partitioning: Designed for disconnected subgraphs; produced unexpected results on connected branches.
- ELK layered algorithm: Higher-quality edge routing but inconsistent Y placement across partition boundaries.
