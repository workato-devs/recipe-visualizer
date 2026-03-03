# IGM Schema + Mapping Rules (v2 Merged)
_Workato recipe-shaped JSON + generic JSON structure -> Intermediate Graph Model (IGM)_

This merged spec combines the Workato recipe mapping rules (v1.2) with generic JSON structure visualization requirements from the extension spec. It is designed to be the single IGM contract for the extension host and the webview renderer.

---

## 0) Scope and modes

### In scope
- Workato recipe-shaped JSON mapping (workflow-like graph).
- Generic JSON structure mapping (arrays/objects/scalars).
- Deterministic IDs and JSON Pointer source mapping.
- Optional data-flow edges (Workato datapills).
- Collapse/expand grouping hints.

### Out of scope (v2)
- Export/import, Workato API calls, CLI integration.
- Full recipe builder parity.
- Editing/authoring UX beyond visualization toggles.
- Loop constructs (`repeat`, `foreach`) for Workato recipes (defer to v3).

### Mode selection
- If the document contains `recipe.code` with Workato-like `keyword` blocks, use the **Workato mapping**.
- Otherwise, use the **generic JSON structure mapping**.

---

## 1) IGM schema (TypeScript types)

### Node kinds
```ts
export type IgmNodeKind =
  // Workato recipe nodes
  | "trigger"
  | "action"
  | "if"
  | "else"
  | "try"
  | "catch"
  | "branch"
  | "join"
  | "end"

  // Generic JSON structure nodes
  | "json_root"
  | "object"
  | "array"
  | "array_item"
  | "value";
```

### Edge kinds
```ts
export type IgmEdgeKind =
  // Workato execution/data
  | "next"
  | "true"
  | "false"
  | "error"
  | "terminal"
  | "data"

  // Generic JSON structure
  | "contains";
```

### Source mapping
```ts
export interface SourceRef {
  jsonPointer: string;
  range?: { startLine: number; startCol: number; endLine: number; endCol: number };
}
```

### Step metadata (Workato steps)
```ts
export interface StepMeta {
  keyword: string;
  uuid?: string;
  number?: number;
  as?: string;
  provider?: string | null;
  name?: string;
  input?: unknown;
}
```

### UI metadata (optional)
```ts
export type TriggerType = "api_endpoint" | "callable" | "webhook" | "scheduler" | "unknown";

export interface NodeUi {
  badge?: string;
  collapsedByDefault?: boolean;
  isTerminal?: boolean;
  httpStatus?: string;
  triggerType?: TriggerType;
  isRecipeCall?: boolean;
  hasInputSchema?: boolean;
  hasOutputSchema?: boolean;
}
```

### JSON structure metadata
```ts
export interface JsonMeta {
  jsonType: "object" | "array" | "string" | "number" | "boolean" | "null";
  key?: string;
  index?: number;
  indexRange?: { start: number; end: number };
  depth: number;
  size?: number;
  heterogeneous?: boolean;
  isPrototype?: boolean;
  isVirtual?: boolean;
  preview?: string;
}
```

### Nodes and edges
```ts
export interface IgmNode {
  id: string;
  kind: IgmNodeKind;
  label: string;
  source: SourceRef;
  step?: StepMeta;
  ui?: NodeUi;
  json?: JsonMeta;
  groupId?: string;
}

export interface IgmEdge {
  id: string;
  from: string;
  to: string;
  kind: IgmEdgeKind;
  label?: string;
}
```

### Groups (collapse/expand)
```ts
export interface IgmGroup {
  id: string;
  kind: "object" | "array" | "control" | "custom";
  label: string;
  children: string[];
  collapsedByDefault?: boolean;
  source: SourceRef;
}
```

### Graph container
```ts
export interface RecipeMeta {
  name: string;
  version: number;
  private: boolean;
  concurrency: number;
  connections: Array<{ provider: string; displayName: string; connectionName?: string }>;
}

export interface IgmGraph {
  nodes: IgmNode[];
  edges: IgmEdge[];
  roots: string[];
  groups?: IgmGroup[];
  meta?: RecipeMeta;
  diagnostics?: Array<{ level: "info" | "warn" | "error"; message: string; source?: SourceRef }>;
}
```

---

## 2) Deterministic ID strategy

### Node IDs
- If `step.uuid` exists, use it.
- Fallback to JSON Pointer: `node.id = "ptr:" + source.jsonPointer`.

### Virtual/group nodes
- If/else: `${ifId}::then`, `${ifId}::else`, `${ifId}::join`
- Try/catch: `${tryId}::catch`, `${tryId}::join`
- End node: `::end`

### Edge IDs
- `edge.id = `${kind}|${from}|${to}``

---

## 3) Workato recipe mapping

### 3.1 Executable step predicate
```ts
function isExecutableStep(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (obj.keyword === "else" || obj.keyword === "catch") return false;
  if (typeof obj.keyword === "string") return true;
  if (typeof obj.provider === "string" && typeof obj.name === "string") return true;
  return false;
}
```

### 3.2 Trigger and action nodes
- Trigger: `kind = "trigger"`, label `as ?? name ?? "trigger"`.
- Action: `kind = "action"`, label `as ?? name ?? "action"`.
- Optional enrichments: `badge`, `isTerminal`, `httpStatus`, `isRecipeCall`, schema presence flags.

### 3.3 If/Else
- Partition `if.block[]` into THEN and ELSE steps (else is a sibling inside the if block).
- Create branch nodes: `${ifId}::then`, `${ifId}::else` (if present).
- Create join node `${ifId}::join` only if needed (see join rule).

### 3.4 Try/Catch
- Partition `try.block[]` into TRY and CATCH steps (catch is a sibling inside the try block).
- Create catch node for navigation and branch entry.
- Create join node `${tryId}::join` only if needed (see join rule).

### 3.5 End node
- Exactly one `::end` node per recipe.

### 3.6 Execution edges
- Sequential `next` edges between executable steps in the same block.
- If branching:
  - `IF -true-> THEN_HEAD`
  - `IF -false-> ELSE_HEAD` (if else exists)
  - If no else, `IF -false-> JOIN`
- Try/catch:
  - `TRY -next-> firstTry`
  - `TRY -error-> CATCH`

### 3.7 Join creation rule
Create a join if:
- Any branch has a non-terminal tail, OR
- There is a subsequent step after the control structure.

### 3.8 Terminal and dangling edges
- Terminal nodes connect to `::end` via `terminal` edges.
- Any node with no outgoing edges (except `::end` and terminals) gets `next -> ::end`.

### 3.9 Datapill data edges (optional)
- Extract `_dp('{...}')` payloads from strings in `step.input`.
- Resolve `payload.line` via `aliasMap` (`as` -> nodeId).
- Add `source -data-> current` edges.
- Add diagnostics for parse failures or unresolved aliases.

---

## 4) Generic JSON structure mapping

### 4.1 Root
- Create `json_root` node at `jsonPointer = "/"` with `label = "root"`.

### 4.2 Objects
- Create `object` node.
- For each property:
  - Create a child node for the value with `json.key = <propertyName>`.
  - Add `parent -contains-> child`.
  - Labels: `key` for objects/arrays, `key: <preview>` for scalars.

### 4.3 Arrays (collection + prototype)
- Create `array` node.
- Always create a prototype `array_item` child:
  - `json.isPrototype = true`.
  - If empty, set `jsonType = "null"` and `label = "item"`.

### 4.4 Array expansion (virtualized)
For arrays longer than `maxArrayItems`:
- Create concrete `array_item` nodes for the first `maxArrayItems` items.
- Create one virtual range node with `indexRange` for the rest and `isVirtual = true`.
- Add `array -contains-> item` edges for all items.

### 4.5 Scalars
- Create `value` node with `json.preview` truncated to 64 chars.

---

## 5) Collapse/expand policy

```ts
export interface CollapsePolicy {
  maxDepth: number;        // default: 4
  maxArrayItems: number;   // default: 8
  maxObjectKeys: number;   // default: 12
}
```

Rules:
- Create an `IgmGroup` for each object and array node.
- Mark `collapsedByDefault` when `depth > maxDepth` OR `size > maxObjectKeys` OR `array.length > maxArrayItems`.
- Renderer hides group children when collapsed.

---

## 6) Diagnostics

Emit diagnostics for:
- multiple `else` blocks in one `if.block[]` (warn)
- multiple `catch` blocks in one `try.block[]` (warn)
- `else` outside an `if` (warn)
- `catch` outside a `try` (warn)
- unknown `keyword` values (info)
- missing `uuid` (info)
- unresolved datapill alias (warn)
- unparseable datapill payload (warn)
- heterogeneous array item types (warn)
- deep nesting beyond `maxDepth` (info)
- oversized arrays/objects beyond policy (info)

---

## 7) Implementation outline (non-normative)

```ts
export function buildIgm(input: unknown, opts: { enableDataEdges?: boolean; collapse?: CollapsePolicy }): IgmGraph {
  if (looksLikeWorkatoRecipe(input)) {
    return buildRecipeIgm(input, opts);
  }
  return buildJsonIgm(input, opts);
}
```

Tests:
- Snapshot node/edge determinism.
- Ensure exactly one `::end` for recipes.
- Ensure all nodes have outgoing edges or are terminals/end.
- Verify collapse policy flags for large objects/arrays.
