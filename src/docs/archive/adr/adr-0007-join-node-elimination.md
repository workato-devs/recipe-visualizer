# ADR 0007: Join Node Elimination

Status: Accepted (Implemented v0.3.5)

## Context
The original IGM schema included synthetic "join" nodes to mark where branches converge after if/else and try/catch blocks. These added visual clutter without conveying useful information — users already understand that branches reconnect at the next step.

In v0.3.0, smart join elimination was introduced: join nodes were skipped when only one branch continued (e.g., if-without-else). This reduced clutter but left join nodes for multi-branch convergence.

## Decision
Remove synthetic join nodes entirely from the IGM schema and renderer.

- Removed `"join"` from `IgmNodeKind`.
- Deleted `createJoinNode()` from the transformer.
- Deleted the `JoinNode` React component.
- Branches now connect directly to the next step in the sequence.

## Rationale
- Join nodes added no information — users can see convergence from edges meeting at the next action node.
- Removing them produces cleaner, more compact graphs.
- Smart join elimination (v0.3.0) was the stepping stone that proved join nodes could be removed without losing clarity.
- Fewer node types simplifies both the transformer and the renderer.

## Consequences
- The IGM schema no longer supports representing explicit merge points. If a future feature needs them (e.g., parallel execution), a new node kind would be introduced.
- Existing test fixtures and expected node counts were updated.

## Alternatives Considered
- Keep smart join elimination only: Still leaves join nodes in multi-branch cases, adding visual noise.
- Make join nodes collapsible: Adds UI complexity to hide something that provides no value.
