# IGM Schema + Mapping Rules (v1.2 Merged)
_Workato recipe-shaped JSON → Intermediate Graph Model (IGM) for workflow visualization_

This document defines the **v1.2 Intermediate Graph Model (IGM)** and deterministic mapping rules from Workato-style recipe JSON into an IGM graph that can be rendered in a VS Code-family extension (VS Code / Cursor / Windsurf).

> **Revision notes (v1.2):** This revision merges Claude v1.1 (terminal handling, recipe metadata, trigger classification) with Codex v1 enhancements (path element annotations, comprehensive diagnostics). See Appendix C for full changelog.

---

## Scope and Assumptions

### In scope
- Visualize recipe-shaped JSON as a **workflow-like** directed graph
- Support core control-flow keywords:
  - `trigger`, `action`, `if`, `else`, `try`, `catch`
- Provide **editor navigation** via JSON Pointer (and optionally editor range)
- **Terminal node handling** with explicit `::end` node for visual clarity
- **HTTP status code extraction** for return_response actions
- Infer **data-flow edges** by parsing Workato datapills (optional, high value)

### Out of scope (v1)
- Export/import, Workato API calls, CLI integration
- Full recipe builder parity
- Editing/authoring UX beyond lightweight visualization toggles
- Loop constructs (`repeat`, `foreach`) — deferred to v2
- Cross-recipe drill-down for recipe-to-recipe calls — deferred to v2

### Fixture inputs
- Primary test fixtures from the `dewy-resort/workato/recipes` repository:
  - **Minimal:** `upsert_contact.recipe.json` — basic try/catch, single action
  - **Branching:** `ha_api_control_light.recipe.json` — nested if/else, multiple terminals
  - **Orchestration:** `create_booking_orchestrator.recipe.json` — recipe calls, validation

---

## 1) IGM Schema (TypeScript Types)

### Node kinds
```typescript
export type IgmNodeKind =
  | "trigger"
  | "action"
  | "if"
  | "else"
  | "try"
  | "catch"
  // Virtual/grouping nodes
  | "branch"
  | "join"
  | "end";    // Recipe termination point
```

### Edge kinds
```typescript
export type IgmEdgeKind =
  | "next"      // Sequential execution in a block array
  | "true"      // if → then branch entry
  | "false"     // if → else branch entry
  | "error"     // try → catch branch entry
  | "terminal"  // Explicit return to ::end node
  | "data";     // Datapill-derived dependency (optional)
```

### Source mapping
```typescript
export interface SourceRef {
  /** JSON Pointer into the recipe document, e.g. /code/block/0/block/2 */
  jsonPointer: string;

  /** Optional: editor range if computed (JSONC parser can help) */
  range?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}
```

### Step metadata (for real recipe steps)
```typescript
export interface StepMeta {
  keyword: string;                 // e.g. "action", "if"
  uuid?: string;                   // Recommended unique step ID when present
  number?: number;                 // Ordering metadata if present in JSON
  as?: string;                     // Alias (used by datapills as "line")
  provider?: string | null;        // Connector name; null for catch; absent for if/else
  name?: string;                   // Connector action name
}
```

### UI metadata
```typescript
export type TriggerType =
  | "api_endpoint"
  | "callable"
  | "webhook"
  | "scheduler"
  | "unknown";

export interface NodeUi {
  /** Display badge (provider/action hint) */
  badge?: string;

  /** Collapse state hint */
  collapsedByDefault?: boolean;

  /** Marks node as an explicit termination point (return_response, return_result) */
  isTerminal?: boolean;

  /** HTTP status code for return_response actions */
  httpStatus?: string;

  /** Trigger type classification */
  triggerType?: TriggerType;

  /** Indicates this action calls another recipe */
  isRecipeCall?: boolean;

  /** Schema presence flags (fetch on demand via jsonPointer) */
  hasInputSchema?: boolean;
  hasOutputSchema?: boolean;
}
```

### Nodes and edges
```typescript
export interface IgmNode {
  id: string;           // Stable ID (see ID strategy)
  kind: IgmNodeKind;
  label: string;        // Display label (often `as` or `name`)
  source: SourceRef;    // Navigation anchor
  step?: StepMeta;      // Present for nodes originating from recipe JSON blocks
  ui?: NodeUi;          // Presentation hints
}

export interface IgmEdge {
  id: string;           // Stable (deterministic)
  from: string;
  to: string;
  kind: IgmEdgeKind;
  label?: string;       // Optional label (e.g., for data edges with path annotations)
}
```

### Graph container
```typescript
export interface RecipeConnection {
  provider: string;
  displayName: string;
  connectionName?: string;
}

export interface RecipeMeta {
  name: string;
  version: number;
  private: boolean;
  concurrency: number;
  connections: RecipeConnection[];
}

export interface IgmGraph {
  nodes: IgmNode[];
  edges: IgmEdge[];
  roots: string[];      // Usually the trigger node ID

  /** Recipe-level metadata for sidebar display */
  meta?: RecipeMeta;

  diagnostics?: Array<{
    level: "info" | "warn" | "error";
    message: string;
    source?: SourceRef;
  }>;
}
```

---

## 2) Deterministic ID Strategy

### Node IDs

**Primary rule (recommended):**
- If a step has `uuid`, use it as `node.id`

**Fallback (when `uuid` is missing):**
- Derive `node.id` from its JSON Pointer path:
  - `node.id = "ptr:" + source.jsonPointer`

**Virtual/grouping nodes:**
Derive IDs from the parent step UUID (or pointer fallback):

| Context | Virtual Node ID |
|---------|-----------------|
| If then-branch | `${ifId}::then` |
| If else-branch | `${ifId}::else` |
| If join | `${ifId}::join` |
| Try catch-branch | `${tryId}::catch` |
| Try join | `${tryId}::join` |
| **Recipe end** | `::end` |

### Edge IDs

Derive deterministically:
```typescript
edge.id = `${kind}|${from}|${to}`
```
(Optionally hash if shorter IDs are preferred.)

---

## 3) Recipe Parsing Model

### Step block definition

A **step block** is any object with a `keyword` field. Many step blocks also carry `block: []` to define nested execution steps.

### Traversal

Traverse the recipe from `recipe.code` recursively:
1. At each step block:
   - Create an IGM node for the step (and virtual nodes if needed)
   - If it has `block: []`, treat it as a nested execution context mapped according to keyword semantics

### Executable step predicate

```typescript
function isExecutableStep(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  // else and catch are containers, not mainline executable steps
  if (obj.keyword === "else" || obj.keyword === "catch") return false;
  if (typeof obj.keyword === "string") return true;
  // Some recipes use provider+name without explicit keyword
  if (typeof obj.provider === "string" && typeof obj.name === "string") return true;
  return false;
}
```

---

## 4) Node Mapping Rules

### 4.1 Trigger

If `keyword === "trigger"`:
```typescript
{
  kind: "trigger",
  label: step.as ?? step.name ?? "trigger",
  ui: {
    badge: step.provider && step.name ? `${step.provider}.${step.name}` : undefined,
    triggerType: getTriggerType(step),
  }
}
```

**Trigger type detection:**
```typescript
function getTriggerType(step: StepMeta): TriggerType {
  if (step.provider === "workato_api_platform" && step.name === "receive_request")
    return "api_endpoint";
  if (step.provider === "workato_recipe_function" && step.name === "execute")
    return "callable";
  if (step.provider === "workato_webhook")
    return "webhook";
  if (step.provider === "clock")
    return "scheduler";
  return "unknown";
}
```

### 4.2 Action

If `keyword === "action"` OR if the block has `provider` + `name` without explicit keyword:
```typescript
{
  kind: "action",
  label: step.as ?? step.name ?? "action",
  ui: {
    badge: getProviderDisplayName(step.provider),
    isTerminal: isExplicitTerminal(step),
    httpStatus: step.input?.http_status_code,  // For return_response
    isRecipeCall: isRecipeCall(step),
    hasInputSchema: !!step.extended_input_schema?.length,
    hasOutputSchema: !!step.extended_output_schema?.length,
  }
}
```

**Label fallback (when `as` is missing):**
```typescript
label = step.name ?? (step.keyword + (step.number ? " " + step.number : ""))
```

**Terminal detection:**
```typescript
function isExplicitTerminal(step: any): boolean {
  return (
    (step.provider === "workato_api_platform" && step.name === "return_response") ||
    (step.provider === "workato_recipe_function" && step.name === "return_result")
  );
}
```

**Recipe call detection:**
```typescript
function isRecipeCall(step: any): boolean {
  return step.provider === "workato_recipe_function" && step.name === "call";
}
```

**Provider display name:**
```typescript
function getProviderDisplayName(provider: string | undefined): string | undefined {
  if (!provider) return undefined;

  const KNOWN: Record<string, string> = {
    'salesforce': 'Salesforce',
    'stripe': 'Stripe',
    'workato_api_platform': 'API Platform',
    'workato_recipe_function': 'Recipe Function',
    'logger': 'Logger',
  };

  if (KNOWN[provider]) return KNOWN[provider];

  // Custom connector pattern: name__connector_XXXXX_XXXXX
  const customMatch = provider.match(/^(.+?)__connector_\d+_\d+$/);
  if (customMatch) {
    return customMatch[1]
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return provider;
}
```

### 4.3 If / Else

If `keyword === "if"`:
1. Create an `"if"` node
2. Partition its `block[]` into:
   - **THEN steps**: items until the first element where `keyword === "else"`
   - **ELSE steps**: the `block[]` inside that `else` element (if present)

Create virtual nodes:
- `${ifId}::then` (kind `"branch"`, label `"Then"`)
- `${ifId}::else` (kind `"branch"`, label `"Else"`) — only if else exists
- `${ifId}::join` (kind `"join"`, label `"Join"`) — see join creation rules below

If `keyword === "else"`:
- Treat as a **branch container**, not a sequential step
- Process its `block[]` as the else branch content

**Virtual node source mapping:**
Use the parent `if` step's `jsonPointer` for `::then`, `::else`, and `::join` virtual nodes. The real `else` node (if created for navigation) uses its own `jsonPointer`.

### 4.4 Try / Catch

If `keyword === "try"`:
1. Create a `"try"` node
2. Partition its `block[]` into:
   - **TRY steps**: items until the first element where `keyword === "catch"`
   - **CATCH steps**: the `block[]` inside that catch element (if present)

Create virtual nodes:
- `${tryId}::catch` (kind `"branch"`, label `"Catch"`) — if catch exists
- `${tryId}::join` (kind `"join"`, label `"Join"`) — see join creation rules below

If `keyword === "catch"`:
- Create a `"catch"` node (useful for navigation and as error branch entry)
- Process its `block[]` as the catch branch content
- **Important:** Always create a `"catch"` node for navigation and datapill resolution, but keep it out of mainline sequencing

**Virtual node source mapping:**
Use the parent `try` step's `jsonPointer` for `::join` virtual nodes. The real `catch` node uses its own `jsonPointer`.

### 4.5 End Node

Every recipe has exactly one `::end` node:
```typescript
{
  id: "::end",
  kind: "end",
  label: "End",
  source: { jsonPointer: "/" },
}
```

---

## 5) Edge Mapping Rules

### 5.1 Sequential `next` edges

Given a list of executable step nodes `[A, B, C]` in the same block context:
- Add `A -next→ B`, `B -next→ C`

**Exception:** If a node has `ui.isTerminal === true`, it does NOT get an outgoing `next` edge to the subsequent step. Instead, it connects to `::end` (see section 5.5).

### 5.2 If branching edges

Let:
- `IF` = node for the `if` step
- `THEN_HEAD` = `${ifId}::then`
- `ELSE_HEAD` = `${ifId}::else` (if present)
- `JOIN` = `${ifId}::join` (if created)
- `thenSteps`, `elseSteps` = partitioned executable nodes

**Edges:**
```
IF -true→ THEN_HEAD
IF -false→ ELSE_HEAD (if else exists)
IF -false→ JOIN (if else does NOT exist)

THEN_HEAD -next→ thenSteps[0] (if any)
ELSE_HEAD -next→ elseSteps[0] (if any)
```

**Empty branch handling:**
- If `thenSteps` is empty: `THEN_HEAD -next→ JOIN`
- If `elseSteps` is empty: `ELSE_HEAD -next→ JOIN`

**Branch tails to join** (if join is created):
```
tail(thenSteps) -next→ JOIN (if tail is not terminal)
tail(elseSteps) -next→ JOIN (if tail is not terminal)
```

**Continuation:**
```
JOIN -next→ NEXT_AFTER_IF (the next executable node after the if block)
```

### 5.3 Try/catch edges

Let:
- `TRY` = node for the `try` step
- `CATCH` = node for the `catch` step (if present)
- `JOIN` = `${tryId}::join` (if created)
- `trySteps`, `catchSteps` = partitioned executable nodes

**Edges:**
```
TRY -next→ trySteps[0] (if any)
TRY -error→ CATCH (if catch exists)

CATCH -next→ catchSteps[0] (if any)
```

**Branch tails to join** (if join is created):
```
tail(trySteps) -next→ JOIN (if tail is not terminal)
tail(catchSteps) -next→ JOIN (if tail is not terminal)
```

**Continuation:**
```
JOIN -next→ NEXT_AFTER_TRY (next executable node after the try block)
```

### 5.4 Join node creation rules

A join node should only be created if:
1. At least one branch has a non-terminal tail, OR
2. There is a subsequent step after the control structure

```typescript
function shouldCreateJoin(branchTails: IgmNode[], hasNextStep: boolean): boolean {
  const hasNonTerminalBranch = branchTails.some(tail => !tail.ui?.isTerminal);
  return hasNonTerminalBranch || hasNextStep;
}
```

If all branches terminate AND there's no subsequent step, the join can be omitted (terminals connect directly to `::end`).

### 5.5 Terminal edges to `::end`

Explicit terminal nodes connect to `::end`:
```typescript
for (const node of nodes) {
  if (node.ui?.isTerminal) {
    edges.push({
      id: `terminal|${node.id}|::end`,
      from: node.id,
      to: "::end",
      kind: "terminal",
    });
  }
}
```

### 5.6 Dangling nodes to `::end`

After all edges are created, find nodes with no outgoing edges (except `::end` itself and terminal nodes which are already handled):

```typescript
const nodesWithOutgoing = new Set(edges.map(e => e.from));

for (const node of nodes) {
  if (node.id === "::end") continue;
  if (node.ui?.isTerminal) continue;  // Already has terminal edge

  if (!nodesWithOutgoing.has(node.id)) {
    edges.push({
      id: `next|${node.id}|::end`,
      from: node.id,
      to: "::end",
      kind: "next",
    });
  }
}
```

---

## 6) Datapill-Derived `data` Edges (Optional)

### 6.1 Datapill formats

Datapills appear in two forms:

**Interpolation mode:**
```
#{_dp('{"pill_type":"output","provider":"stripe","line":"search_customer","path":["data","id"]}')}
```

**Formula mode:**
```
=_dp('{"pill_type":"output",...}')
=_dp('{"pill_type":"output",...}').present? ? _dp('...') : skip
```

### 6.2 Extraction pattern

```typescript
const DATAPILL_PATTERN = /(?:#{)?_dp\('(\{[^']+\})'\)(?:})?/g;

function extractDatapills(value: string): DatapillPayload[] {
  const results: DatapillPayload[] = [];
  let match;
  while ((match = DATAPILL_PATTERN.exec(value)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch (e) {
      // Track parse failure for diagnostics (see section 6.6)
    }
  }
  return results;
}
```

### 6.3 Resolution strategy

During graph build:
1. Build `aliasMap: Map<string, string>` mapping `step.as` → `nodeId` for all nodes
2. Walk each step's `input` object (recursively through nested objects/arrays)
3. For each string value, extract datapill payloads
4. Resolve source node: `sourceNodeId = aliasMap.get(payload.line)`
5. Add data edge: `sourceNodeId -data→ currentStepNodeId`

### 6.4 Path element annotations

If the datapill payload includes a `path` array with annotated elements, extract labels for the data edge:

| `path_element_type` | Edge Label | Example |
|---------------------|------------|---------|
| `"current_item"` | `"current_item"` | Array item iteration dependency |
| `"size"` | `"size"` | Array size reference |
| `"join"` (with `action`) | `"join:<action>"` | Joined array output |
| `"join"` (no `action`) | `"join"` | Joined array output (default) |

```typescript
function getDataEdgeLabel(payload: DatapillPayload): string | undefined {
  if (!payload.path || !Array.isArray(payload.path)) return undefined;
  
  for (const element of payload.path) {
    if (typeof element === "object" && element.path_element_type) {
      switch (element.path_element_type) {
        case "current_item":
          return "current_item";
        case "size":
          return "size";
        case "join":
          return element.action ? `join:${element.action}` : "join";
      }
    }
  }
  return undefined;
}
```

### 6.5 Special cases

**Catch as provider:**
When `payload.provider === "catch"`, the source is the catch node itself:
```typescript
if (payload.provider === "catch") {
  sourceNodeId = aliasMap.get(payload.line);  // Catches use their `as` value
}
```

**Unresolved references:**
If `payload.line` cannot be resolved:
- Add a `warn` diagnostic (see section 7)
- Do not create a dangling edge

### 6.6 Datapill parsing failures

If the JSON payload inside `_dp('...')` fails to parse:
- Add a `warn` diagnostic with the source pointer
- Continue processing other datapills in the same string

---

## 7) Diagnostics Rules

Emit structured diagnostics for:

| Condition | Level | Message |
|-----------|-------|---------|
| Multiple `else` blocks in one `if.block[]` | warn | `"Multiple else blocks in if statement"` |
| Multiple `catch` blocks in one `try.block[]` | warn | `"Multiple catch blocks in try statement"` |
| `else` outside `if.block[]` | warn | `"else block outside of if context"` |
| `catch` outside `try.block[]` | warn | `"catch block outside of try context"` |
| Unknown `keyword` value | info | `"Unknown keyword: ${keyword}"` |
| Missing `uuid` | info | `"Step missing uuid, using pointer-based ID"` |
| Unresolved datapill reference | warn | `"Unresolved datapill reference: ${line}"` |
| Unparseable datapill payload | warn | `"Unparseable datapill payload at ${jsonPointer}"` |

---

## 8) Recipe Metadata Extraction

Extract recipe-level metadata for sidebar display:

```typescript
function extractRecipeMeta(recipe: any): RecipeMeta {
  return {
    name: recipe.name,
    version: recipe.version ?? 1,
    private: recipe.private ?? true,
    concurrency: recipe.concurrency ?? 1,
    connections: (recipe.config ?? [])
      .filter((c: any) => c.keyword === "application")
      .map((c: any) => ({
        provider: c.provider,
        displayName: getProviderDisplayName(c.provider) ?? c.provider,
        connectionName: c.account_id?.name,
      })),
  };
}
```

---

## 9) Implementation Reference

### Main build function

```typescript
export interface BuildOptions {
  enableDataEdges?: boolean;  // Default: false
}

export function buildIgm(recipeJson: unknown, opts?: BuildOptions): IgmGraph {
  const recipe = recipeJson as any;
  const nodes: IgmNode[] = [];
  const edges: IgmEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const aliasMap = new Map<string, string>();

  // 1. Traverse recipe.code and build nodes
  const rootId = traverseBlock(recipe.code, "/code", nodes, edges, aliasMap, diagnostics);

  // 2. Add ::end node
  nodes.push({
    id: "::end",
    kind: "end",
    label: "End",
    source: { jsonPointer: "/" },
  });

  // 3. Connect terminals to ::end
  for (const node of nodes) {
    if (node.ui?.isTerminal) {
      edges.push({
        id: `terminal|${node.id}|::end`,
        from: node.id,
        to: "::end",
        kind: "terminal",
      });
    }
  }

  // 4. Connect dangling nodes to ::end
  const nodesWithOutgoing = new Set(edges.map(e => e.from));
  for (const node of nodes) {
    if (node.id === "::end") continue;
    if (node.ui?.isTerminal) continue;
    if (!nodesWithOutgoing.has(node.id)) {
      edges.push({
        id: `next|${node.id}|::end`,
        from: node.id,
        to: "::end",
        kind: "next",
      });
    }
  }

  // 5. Optional: build data edges
  if (opts?.enableDataEdges) {
    buildDataEdges(nodes, edges, aliasMap, diagnostics);
  }

  // 6. Extract metadata
  const meta = extractRecipeMeta(recipe);

  return {
    nodes,
    edges,
    roots: rootId ? [rootId] : [],
    meta,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  };
}
```

### Test strategy

1. Use fixture recipe JSON files from `dewy-resort/workato/recipes`
2. Snapshot the resulting IGM graph (nodes + edges)
3. Assertions:
   - Node IDs are stable across runs
   - Edge count matches expected
   - All non-end nodes have outgoing edges OR are terminals
   - Exactly one `::end` node exists
   - All terminals have exactly one outgoing edge (to `::end`)
   - Traversal order is deterministic

---

## 10) Rendering Guidelines (Non-Normative)

These are recommendations for renderers, not part of the IGM spec itself.

### Visual styling

| Node Kind | Shape | Fill | Border |
|-----------|-------|------|--------|
| trigger | Rounded rect | Light blue | Solid |
| action | Rectangle | White | Solid |
| action (isTerminal) | Rectangle | White | Double |
| try | Diamond | Light yellow | Solid |
| catch | Diamond | Light red | Solid |
| if | Diamond | Light gray | Solid |
| else | Diamond | Light gray | Dashed |
| branch | Small pill | Light gray | Solid |
| join | Small circle | Gray | Solid |
| end | Filled circle | Dark gray | None |

### Terminal HTTP status styling

For nodes with `ui.httpStatus`:

| Status Range | Color |
|--------------|-------|
| 2xx | Green |
| 3xx | Blue |
| 4xx | Orange |
| 5xx | Red |

### Edge styling

| Kind | Style | Color |
|------|-------|-------|
| next | Solid arrow | Gray |
| true | Solid arrow | Green |
| false | Solid arrow | Red |
| error | Dashed arrow | Red |
| terminal | Dotted arrow | Dark gray |
| data | Dotted line | Blue |

### Interaction patterns

| Interaction | Behavior |
|-------------|----------|
| Single click | Select node, show details panel |
| Double click | Navigate to source via `jsonPointer` |
| Hover | Show tooltip with step metadata |

---

## Appendix A: Example Graph (upsert_contact.recipe.json)

### Input structure
```
trigger (callable)
└── try
    ├── upsert_contact (salesforce.upsert_sobject)
    ├── return_result (terminal)
    └── catch
        └── log_error (logger)
```

### Resulting nodes

| ID | Kind | Label | Terminal |
|----|------|-------|----------|
| create-contact-trigger-001 | trigger | trigger | |
| create-contact-try-001 | try | Try | |
| create-contact-upsert-001 | action | upsert_contact | |
| create-contact-return-001 | action | return_result | YES |
| create-contact-catch-001 | catch | Catch | |
| create-contact-log-001 | action | log_error | |
| create-contact-try-001::join | join | Join | |
| ::end | end | End | |

### Resulting edges

| From | To | Kind |
|------|----|------|
| trigger-001 | try-001 | next |
| try-001 | upsert-001 | next |
| upsert-001 | return-001 | next |
| return-001 | ::end | terminal |
| try-001 | catch-001 | error |
| catch-001 | log-001 | next |
| log-001 | join | next |
| join | ::end | next |

### Visual representation
```
       ┌──────────┐
       │ trigger  │
       └────┬─────┘
            │
            ▼
       ┌──────────┐
       │   Try    │─────────error─────────┐
       └────┬─────┘                       │
            │                             │
            ▼                             ▼
    ┌──────────────┐               ┌──────────┐
    │upsert_contact│               │  Catch   │
    └──────┬───────┘               └────┬─────┘
           │                            │
           ▼                            ▼
    ┌──────────────┐               ┌──────────┐
    │return_result │               │log_error │
    │      ●       │               └────┬─────┘
    └──────┬───────┘                    │
           ╎ terminal                   ▼
           ╎                       ┌──────────┐
           ╎                       │   Join   │
           ╎                       └────┬─────┘
           ╎                            │
           ▼                            ▼
    ┌─────────────────────────────────────────┐
    │                   End                   │
    │                    ◼                    │
    └─────────────────────────────────────────┘
```

---

## Appendix B: Datapill Payload Reference

### Example payload structure
```json
{
  "pill_type": "output",
  "provider": "stripe",
  "line": "search_customer",
  "path": [
    "data",
    { "path_element_type": "current_item" },
    "id"
  ]
}
```

### Field definitions

| Field | Type | Description |
|-------|------|-------------|
| `pill_type` | string | Always `"output"` for step outputs |
| `provider` | string | Connector name (e.g., `"stripe"`, `"catch"`) |
| `line` | string | The `as` alias of the source step |
| `path` | array | Path to the specific field within the output |

### Path element types

| Type | Purpose | Example |
|------|---------|---------|
| `"current_item"` | Array iteration context | `{"path_element_type": "current_item"}` |
| `"size"` | Array length reference | `{"path_element_type": "size"}` |
| `"join"` | Joined array output | `{"path_element_type": "join", "action": "concat"}` |

---

## Appendix C: Changelog

### v1.2 (Merged Spec)
- Merged Claude v1.1 and Codex v1 enhancements
- Added `path_element_type` edge labeling rules (from Codex)
- Added unparseable datapill diagnostic (from Codex)
- Added explicit `if` without `else` edge handling: `IF -false→ JOIN`
- Added empty branch handling rules
- Added Appendix B: Datapill Payload Reference
- Clarified virtual node source mapping

### v1.1 (Claude POC Revision)
- Added `"end"` node kind for recipe termination
- Added `"terminal"` edge kind for explicit returns
- Added `ui.isTerminal`, `ui.httpStatus`, `ui.triggerType`, `ui.isRecipeCall` fields
- Added `RecipeMeta` with connections extraction
- Clarified formula-mode datapill parsing (`=_dp(...)` in addition to `#{_dp(...)}`)
- Added join node creation rules (skip if all branches terminate)
- Added provider display name utility for custom connectors
- Specified test fixtures from dewy-resort repository
- Added rendering guidelines (non-normative)

### v1.0 (Original)
- Initial schema definition
- Core node and edge kinds
- Basic traversal and mapping rules
