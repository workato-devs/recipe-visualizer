# IGM Addendum: Array + Group + Collapse Semantics (Spec Alignment)

This addendum extends `docs/igm-spec.md` to satisfy the extension spec requirements for generic JSON structure visualization. It is intentionally additive and does not change the Workato recipe mapping rules.

---

## 1) Schema additions (minimal, additive)

### 1.1 New node kinds (JSON structure)
```ts
export type IgmNodeKind =
  | "json_root"   // root of a non-recipe JSON document
  | "object"      // object value
  | "array"       // array value (collection)
  | "array_item"  // array item or array item prototype
  | "value";      // scalar (string/number/bool/null)
```

### 1.2 New edge kind (structure)
```ts
export type IgmEdgeKind =
  | "contains";  // parent -> child structural relationship
```

### 1.3 JSON metadata for structure nodes
```ts
export interface JsonMeta {
  jsonType: "object" | "array" | "string" | "number" | "boolean" | "null";
  key?: string;                      // object property name
  index?: number;                    // array item index
  indexRange?: { start: number; end: number };  // virtualized range
  depth: number;                     // depth from root
  size?: number;                     // object key count or array length
  heterogeneous?: boolean;           // true if array mixes item types
  isPrototype?: boolean;             // true for array item prototype
  isVirtual?: boolean;               // true for virtualized range node
  preview?: string;                  // short value preview for scalars
}
```

Add these optional fields to the node type:
```ts
export interface IgmNode {
  json?: JsonMeta;     // present for JSON-structure nodes
  groupId?: string;    // optional group membership
}
```

### 1.4 Group support for collapse/expand
```ts
export interface IgmGroup {
  id: string;
  kind: "object" | "array" | "control" | "custom";
  label: string;
  children: string[];
  collapsedByDefault?: boolean;
  source: SourceRef;
}

export interface IgmGraph {
  groups?: IgmGroup[]; // optional; renderer can ignore if unsupported
}
```

---

## 2) Mode selection (recipe vs generic JSON)

Use the Workato recipe mapping rules when the document contains `recipe.code` with Workato-like `keyword` steps. Otherwise, build a JSON-structure graph using the rules below.

---

## 3) JSON-structure mapping rules

### 3.1 Root
- Create one `json_root` node with `jsonType` inferred from the document.
- `label = "root"`
- `source.jsonPointer = "/"`

### 3.2 Objects
- Create an `object` node for each object value.
- For each property:
  - Create a child node for the value with `json.key = <propertyName>`.
  - Add `parent -contains→ child`.
  - Use `label = key` for object/array children, or `label = key: <preview>` for scalar children.

### 3.3 Arrays (collection + prototype)
- Create an `array` node for each array value.
- Add an `array_item` node as the **prototype** child:
  - `json.isPrototype = true`
  - If array is empty, prototype node can still exist with `jsonType = "null"` and `label = "item"`.
- Add `array -contains→ prototype`.

### 3.4 Array expansion (virtualized items)
For arrays longer than `maxArrayItems`:
- Create concrete `array_item` nodes for the first `maxArrayItems` items.
- Create one virtual range node with `json.indexRange` for the remainder and `json.isVirtual = true`.
- All items (concrete + range) are children of the array via `contains` edges.

### 3.5 Scalars
- Create a `value` node.
- Populate `json.preview` with a short, stable string (truncate after 64 chars).

---

## 4) Collapse/expand policy (default)

Define a renderer-agnostic policy used by the mapper to set `groupId` and `collapsedByDefault`:

```ts
export interface CollapsePolicy {
  maxDepth: number;        // default: 4
  maxArrayItems: number;   // default: 8
  maxObjectKeys: number;   // default: 12
}
```

Rules:
- Create an `IgmGroup` for each object and array node.
- Set `collapsedByDefault` when `depth > maxDepth` OR `size > maxObjectKeys` OR `array.length > maxArrayItems`.
- When collapsed, renderer should show the group root and hide children.

---

## 5) Diagnostics (JSON-structure)

Emit diagnostics in these cases:
- Heterogeneous array item types: warn
- Deep nesting beyond `maxDepth`: info
- Oversized arrays beyond `maxArrayItems`: info
- Oversized objects beyond `maxObjectKeys`: info

---

## 6) Notes on integration with Workato mapping

- Workato steps remain unchanged.
- Arrays that appear inside Workato step inputs can be optionally mapped as **auxiliary structure nodes** using the JSON-structure rules, grouped under the step node with `groupId`.
- This is optional for v1; it can be enabled behind a feature flag.

---

## 7) Non-normative rendering guidance

- Layout: place JSON-structure nodes left-to-right, grouped by depth.
- Collapsed groups should be visually distinct (e.g., pill + count badge).
- Virtualized range nodes should show label like `items 8-124`.
