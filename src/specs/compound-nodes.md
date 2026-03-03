# Feature Spec: Compound Nodes (Hierarchical Layout)

**Version:** Draft
**Status:** Design
**Target Release:** v0.5.0

---

## Problem

Control flow nodes (`try/catch`, `if/then/else`) are laid out sequentially, but they represent **parallel branches** that should visually align as peers:

- In L→R layout: branches should share a vertical axis
- In T→B layout: branches should be side-by-side horizontally

Current:
```
[try] ──error──> [catch] ──> [next]
```

Desired:
```
┌─────────────────────┐
│   [Try-Catch Block] │
│   ┌─────┐ ┌─────┐   │
│   │ try │ │catch│   │
│   └─────┘ └─────┘   │
└─────────────────────┘
          │
          ▼
       [next]
```

---

## Scope

| Structure | Container Type | Children |
|-----------|----------------|----------|
| `try/catch` | `try-catch-block` | `try`, `catch` |
| `if/then/else` | `if-block` | `if`, `then`, `else` |
| `foreach` | TBD - may not need (loop is inherently sequential) |

---

## IGM Model Changes

### Option A: Parent Reference

Add `parentId` to nodes:

```typescript
interface IgmNode {
  id: string;
  kind: IgmNodeKind;
  parentId?: string;        // NEW: Reference to container node
  // ...existing fields
}
```

Container nodes are just regular nodes with a new kind:

```typescript
type IgmNodeKind =
  | "trigger"
  | "action"
  // ...existing kinds
  | "try-block"             // NEW: Container for try + catch
  | "if-block"              // NEW: Container for if + then + else
```

### Option B: Children Array

Add `children` to container nodes:

```typescript
interface IgmNode {
  id: string;
  kind: IgmNodeKind;
  children?: string[];      // NEW: Child node IDs (for containers)
  // ...existing fields
}
```

### Recommendation: Option A (parentId)

- Simpler to construct during transformation
- Matches React Flow's compound node model
- Easier to query "what's my parent?" than "who contains me?"

---

## Transformer Changes

### Try-Catch

Current flow:
```typescript
function processTry(step, jsonPointer, ctx): TraversalResult {
  const tryNode = createTryNode(step, jsonPointer);
  // ...process try body...
  // ...process catch...
  ctx.edges.push({ from: tryNode.id, to: catchNode.id, kind: "error" });
}
```

New flow:
```typescript
function processTry(step, jsonPointer, ctx): TraversalResult {
  // 1. Create container node
  const blockNode = createTryCatchBlockNode(step, jsonPointer);
  ctx.nodes.push(blockNode);

  // 2. Create try node as child
  const tryNode = createTryNode(step, jsonPointer);
  tryNode.parentId = blockNode.id;
  ctx.nodes.push(tryNode);

  // 3. Create catch node as child (if present)
  if (catchContainer) {
    const catchNode = createCatchNode(catchContainer, catchPointer);
    catchNode.parentId = blockNode.id;
    ctx.nodes.push(catchNode);
  }

  // 4. Internal edges stay within block
  // 5. Return block node as head/tail for external connections
  return { headNodeId: blockNode.id, tailNodes: [blockNode] };
}
```

### If-Then-Else

Similar pattern:
```typescript
function processIf(step, jsonPointer, ctx): TraversalResult {
  // 1. Create container node
  const blockNode = createIfBlockNode(step, jsonPointer);

  // 2. Create if node as child (the condition)
  const ifNode = createIfNode(step, jsonPointer);
  ifNode.parentId = blockNode.id;

  // 3. Create then branch as child
  const thenBranch = createBranchNode(ifNode.id, "then", ...);
  thenBranch.parentId = blockNode.id;

  // 4. Create else branch as child (if present)
  if (elseContainer) {
    const elseBranch = createBranchNode(ifNode.id, "else", ...);
    elseBranch.parentId = blockNode.id;
  }

  // 5. Return block as head/tail
  return { headNodeId: blockNode.id, tailNodes: [blockNode] };
}
```

---

## Edge Routing

### Internal vs External Edges

- **Internal edges**: Connect nodes within the same container (stay inside the box)
- **External edges**: Connect to/from the container node itself

```
                    External edge
                         │
                         ▼
┌─────────────────────────────────────┐
│ [If-Block]                          │
│                                     │
│   [if] ──true──> [then]             │  ← Internal edges
│     │                               │
│     └──false──> [else]              │
│                                     │
└─────────────────────────────────────┘
                         │
                         ▼ External edge
                      [next]
```

### Edge Model Change

Add optional flag to indicate internal edges:

```typescript
interface IgmEdge {
  id: string;
  from: string;
  to: string;
  kind: IgmEdgeKind;
  internal?: boolean;       // NEW: Edge stays within parent container
}
```

Or: Infer from node parentIds at render time (if both endpoints share same parent → internal).

---

## React Flow Integration

React Flow supports compound nodes via `parentId` property:

```typescript
const nodes = [
  { id: 'block-1', type: 'ifBlock', position: { x: 0, y: 0 } },
  { id: 'if-1', parentId: 'block-1', position: { x: 10, y: 10 } },   // Relative position!
  { id: 'then-1', parentId: 'block-1', position: { x: 100, y: 10 } },
];
```

Key behaviors:
- Child positions are **relative to parent**
- Parent auto-sizes to fit children (with `extent: 'parent'`)
- Moving parent moves all children

### ELK + Compound Nodes

ELK natively supports hierarchical graphs:

```typescript
const elkGraph = {
  id: "root",
  children: [
    {
      id: "block-1",
      children: [                    // Nested children!
        { id: "try-1", width: 50, height: 28 },
        { id: "catch-1", width: 60, height: 28 },
      ],
      edges: [
        { id: "e1", sources: ["try-1"], targets: ["catch-1"] }  // Internal edge
      ]
    },
    { id: "next-action", width: 200, height: 65 }
  ],
  edges: [
    { id: "e2", sources: ["block-1"], targets: ["next-action"] }  // External edge
  ]
};
```

ELK will:
1. Layout children within each compound node
2. Layout compound nodes relative to each other
3. Route edges appropriately

---

## Visual Design

### Axis Alignment (Swim Lane Effect)

**Critical**: Branches should straddle the main flow axis, not sit on one side of it.

**L→R Layout:**
```
                  ┌─────┐
                  │ try │
                  └─────┘
[prev] ─────────────●───────────── [next]   ← Main axis stays straight through block center
                  ┌─────┐
                  │catch│
                  └─────┘
```

**T→B Layout:**
```
        [prev]
           │
    ┌──────┼──────┐
    │      ●      │
 ┌─────┐      ┌─────┐
 │ try │      │catch│
 └─────┘      └─────┘
    │             │
    └──────┬──────┘
           │
        [next]
```

The compound block's **center** sits on the main flow axis. This creates clear "swim lanes" where:
- Main happy path stays on the central axis
- Error/alternate branches are visually offset but balanced

### ELK Configuration for Axis Alignment

May require:
- `elk.alignment`: Force container to center-align with incoming/outgoing edges
- Custom port positioning: Entry/exit ports at container center, not corner
- Child layout within container: Distribute children symmetrically around center

### Container Appearance

Containers should be subtle - not dominate visually:

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    ← Dashed border, muted color
  [try]       [catch]
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

Options:
- Dashed border with transparent/subtle fill
- Just padding/spacing, no visible border
- Colored background region (like a swimlane band)

### Collapsed State (Future)

Containers enable collapse:

```
[+ Try-Catch Block] ──> [next]    ← Collapsed (hides children)
```

---

## Implementation Steps

### Phase 1: Model + Transformer
1. Add `parentId` to `IgmNode` type
2. Add new node kinds: `try-block`, `if-block`
3. Update `processTry()` to create block + children
4. Update `processIf()` to create block + children
5. Mark internal edges

### Phase 2: Layout
1. Update `useLayout.ts` to build hierarchical ELK graph
2. Convert ELK output to React Flow positions (handling relative coords)

### Phase 3: Rendering
1. Create `BlockNode` component (container styling)
2. Pass `parentId` to React Flow nodes
3. Style internal vs external edges differently (optional)

### Phase 4: Polish
1. Auto-size containers to fit children
2. Handle edge cases (empty catch, no else)
3. Test with all fixtures

---

## Open Questions

1. **Should `foreach` be a container?** Loop body could be children, but the sequential nature might not benefit.

2. **Nested compounds?** If inside try-catch - how deep can nesting go? ELK handles it, but visual complexity increases.

3. **What about branch nodes (Then/Else)?** Currently these are just pills. Should the condition (`if`) be a child alongside `then`/`else`, or the container label?

4. **Edge visibility**: Should internal edges be hidden/dimmed, or shown normally?

---

## Alternatives Considered

### Layer Constraints Only
Force nodes to same layer without containers. Rejected: doesn't provide grouping for collapse or clear visual boundaries.

### CSS-Only Swimlanes
Render colored bands behind certain node types. Rejected: doesn't affect layout, just decoration.

### Post-Layout Adjustment
Let ELK layout normally, then manually shift nodes. Rejected: fragile, fights the layout engine.

---

## References

- ELK Hierarchical Layout: https://eclipse.dev/elk/reference/options.html
- React Flow Compound Nodes: https://reactflow.dev/examples/layout/sub-flows
- Current layout code: `webview-ui/src/useLayout.ts`
- Current transformer: `core/transformer.ts`
