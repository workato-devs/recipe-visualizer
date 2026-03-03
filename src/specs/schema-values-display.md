# Feature Spec: Schema Values Display

**Version:** 1.0
**Status:** Implemented (v0.4.2)
**Effort:** Medium

---

## Overview

Enhance the Node Details Panel to display actual input values alongside schema field definitions. This gives users immediate visibility into what data is being passed to each step without needing to cross-reference separate sections.

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Input schema values | Output schema values (runtime-only) |
| Datapill references | Full formula parsing/evaluation |
| Literal values | Editing values |
| Nested object values | Array item values |

**Why output schemas are excluded:** Output schemas define what a step *will produce* at runtime. The actual output values don't exist in the recipe JSON—they're determined during execution.

---

## Current State

### Data Flow

```
Recipe JSON
    │
    ├── step.extended_input_schema  →  extractSchemaFields()  →  node.inputSchema
    ├── step.input                  →  extractStepInputs()    →  node.step.inputs
    └── step.extended_output_schema →  extractSchemaFields()  →  node.outputSchema
```

### Current UI (NodeDetailsPanel.tsx)

Two separate sections:
1. **Step Inputs** - Flattened key/value pairs from `step.input`
2. **Input Schema** - Field definitions (name, type, optional)

Users must mentally correlate these sections to understand "field X expects a string, and it's receiving datapill Y."

---

## Proposed Design

### Data Model Change

Extend `SchemaField` in `shared/types.ts`:

```typescript
export interface SchemaField {
  name: string;
  label?: string;
  type: string;
  optional?: boolean;
  properties?: SchemaField[];  // For nested object fields
  value?: string;              // NEW: Actual input value (simplified)
}
```

### Transformer Change

Update `extractSchemaFields()` in `core/transformer.ts` to accept an optional `inputValues` parameter:

```typescript
function extractSchemaFields(
  schema: any[] | undefined,
  inputValues?: Record<string, any>  // NEW: values to merge
): SchemaField[] | undefined
```

**Matching Logic:**
1. For each schema field, look up `inputValues[field.name]`
2. If found, simplify the value using existing `simplifyValue()` function
3. For nested `properties`, recursively match with `inputValues[field.name]` (if it's an object)

### UI Change

Update `SchemaFieldRow` in `NodeDetailsPanel.tsx` to display values:

```
┌─────────────────────────────────────────────────────────┐
│ Input Schema (7) ⚠ 1 required field unmapped        ▼   │
├─────────────────────────────────────────────────────────┤
│ ⚠ AccountId* (string)      —                            │
│   Email* (string)          ← trigger.parameters.email   │
│   FirstName (string)       ← trigger.parameters.first…  │
│   LastName* (string)       ← trigger.parameters.last_…  │
│   Phone (string)           —                            │
│   ▶ query_field (object)                                │
└─────────────────────────────────────────────────────────┘
```

Visual indicators:
- `←` prefix for values
- `—` for fields with no value set
- `⚠` warning icon for required fields without values (both in header summary and inline)
- Truncate long values with tooltip on hover

---

## Value Formatting

Reuse and extend `simplifyValue()` function:

| Raw Value | Display |
|-----------|---------|
| `"Contact"` | `Contact` |
| `"#{_dp('{...path:[\"parameters\",\"email\"]}')}"`  | `trigger.parameters.email` |
| `"=_dp(...).present? ? _dp(...) : skip"` | `(formula)` |
| `123` | `123` |
| `true` | `true` |
| `null` / undefined | `—` |
| Complex object | `{...}` |

---

## Matching Rules

### Top-Level Fields

```javascript
// Schema field
{ name: "Email", type: "string" }

// Input values
{ "Email": "#{_dp(...)}" }

// Match: inputValues["Email"] → schema field "Email"
```

### Nested Object Fields

```javascript
// Schema field
{
  name: "result",
  type: "object",
  properties: [
    { name: "id", type: "string" },
    { name: "email", type: "string" }
  ]
}

// Input values
{
  "result": {
    "id": "#{_dp(...)}",
    "email": "#{_dp(...)}"
  }
}

// Match: inputValues.result.id → schema.result.properties[name="id"]
```

### Unmatched Cases

| Case | Behavior |
|------|----------|
| Schema field with no input value | Show field without value (`—`) |
| Input value with no schema field | Ignore (already shown in Step Inputs) |
| Type mismatch | Show value anyway (no validation) |

---

## Implementation Steps

### 1. Update Types (`shared/types.ts`)

```diff
 export interface SchemaField {
   name: string;
   label?: string;
   type: string;
   optional?: boolean;
   properties?: SchemaField[];
+  value?: string;
 }
```

### 2. Update Transformer (`core/transformer.ts`)

Modify `extractSchemaFields()`:

```typescript
function extractSchemaFields(
  schema: any[] | undefined,
  inputValues?: Record<string, any>
): SchemaField[] | undefined {
  if (!schema || !Array.isArray(schema) || schema.length === 0) {
    return undefined;
  }

  const extractField = (field: any, values?: Record<string, any>): SchemaField => {
    const fieldValue = values?.[field.name];

    const result: SchemaField = {
      name: field.name || "unknown",
      label: field.label,
      type: field.type || "string",
      optional: field.optional,
    };

    // Add simplified value if present
    if (fieldValue !== undefined) {
      if (typeof fieldValue === "object" && fieldValue !== null) {
        // For objects, we'll handle nested properties
        // Don't set a value for the parent object itself
      } else {
        result.value = simplifyValue(fieldValue);
      }
    }

    // Handle nested object properties
    if (field.properties && Array.isArray(field.properties)) {
      const nestedValues = typeof fieldValue === "object" ? fieldValue : undefined;
      result.properties = field.properties.map((p: any) => extractField(p, nestedValues));
    }

    return result;
  };

  return schema.map((field) => extractField(field, inputValues));
}
```

Update callers to pass input values:

```typescript
// In createActionNode():
const inputSchema = extractSchemaFields(step.extended_input_schema, step.input);

// In createTriggerNode() for callable triggers:
inputSchema = parseJsonSchemaString(step.input.parameters_schema_json);
// Note: Callable triggers don't have input values in the same way - they define expected parameters
```

### 3. Update UI (`webview-ui/src/NodeDetailsPanel.tsx`)

#### Update `SchemaSection` to show warning summary:

```tsx
function SchemaSection({ title, fields, variant }: SchemaSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count required fields without values
  const countUnmappedRequired = (fields: SchemaField[]): number => {
    return fields.reduce((count, field) => {
      const isRequired = field.optional === false;
      const hasValue = field.value !== undefined;
      const unmapped = isRequired && !hasValue ? 1 : 0;
      const nestedCount = field.properties ? countUnmappedRequired(field.properties) : 0;
      return count + unmapped + nestedCount;
    }, 0);
  };

  const unmappedRequiredCount = variant === "input" ? countUnmappedRequired(fields) : 0;

  // ... rest of existing logic ...

  return (
    <>
      <div className="section-divider" />
      <div
        className="section-title section-title-clickable"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`schema-indicator ${variant}`} />
        {title}
        <span className="field-count">({fields.length})</span>
        {unmappedRequiredCount > 0 && (
          <span className="unmapped-warning">
            ⚠ {unmappedRequiredCount} required field{unmappedRequiredCount > 1 ? 's' : ''} unmapped
          </span>
        )}
        {/* ... expand indicator ... */}
      </div>
      {/* ... fields rendering ... */}
    </>
  );
}
```

#### Update `SchemaFieldRow` to show values and inline warnings:

```tsx
function SchemaFieldRow({ field, depth }: SchemaFieldRowProps) {
  // ... existing expand logic ...

  const isRequired = field.optional === false;
  const hasValue = field.value !== undefined;
  const showWarning = isRequired && !hasValue;

  return (
    <div className="schema-field" style={{ marginLeft: depth * 12 }}>
      <div className={`schema-field-row ${hasChildren ? "expandable" : ""} ${showWarning ? "warning" : ""}`}>
        {showWarning && (
          <span className="field-warning-icon" title="Required field without value">⚠</span>
        )}
        {hasChildren && (
          <span className="expand-indicator small">{isExpanded ? "▼" : "▶"}</span>
        )}
        <span className="schema-field-name">
          {field.label || field.name}
          {isRequired && <span className="required-marker">*</span>}
        </span>
        <span className={`schema-field-type type-${field.type}`}>
          {field.type}
        </span>
        {/* Value display */}
        {hasValue ? (
          <span className="schema-field-value" title={field.value}>
            ← {field.value}
          </span>
        ) : (
          <span className="schema-field-value empty">—</span>
        )}
      </div>
      {/* ... existing children rendering ... */}
    </div>
  );
}
```

### 4. Update Styles (`webview-ui/src/App.css`)

```css
/* Value display */
.schema-field-value {
  color: var(--vscode-textPreformat-foreground);
  font-family: var(--vscode-editor-font-family);
  font-size: 0.85em;
  margin-left: auto;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schema-field-value.empty {
  color: var(--vscode-disabledForeground);
}

/* Warning indicators */
.unmapped-warning {
  color: var(--vscode-editorWarning-foreground);
  font-size: 0.85em;
  margin-left: 8px;
}

.field-warning-icon {
  color: var(--vscode-editorWarning-foreground);
  margin-right: 4px;
}

.schema-field-row.warning {
  /* Subtle background highlight for accessibility */
  background-color: var(--vscode-inputValidation-warningBackground);
  border-radius: 2px;
  padding: 2px 4px;
  margin: -2px -4px;
}
```

---

## Edge Cases

### 1. Callable Recipe Triggers

Callable triggers define *expected* input parameters (what callers will provide), not actual values. The `parameters_schema_json` defines the schema, but there are no input values to display.

**Handling:** Don't pass input values for callable triggers. Schema fields will show without values, which is correct.

### 2. Dynamic/Computed Fields

Some fields like `sobject_name` in Salesforce actions are structural, not user-provided data.

**Handling:** Show them anyway—they're still part of the input mapping.

### 3. Formula Values

Complex formulas like `=_dp(...).present? ? _dp(...) : skip` are hard to summarize.

**Handling:** Display as `(formula)` - the existing `simplifyValue()` function handles this.

### 4. Very Long Values

Datapill paths can be long: `trigger.parameters.customer.billing_address.postal_code`

**Handling:** CSS truncation with full value in tooltip.

### 5. Array Values

Schema may define array types. Input may have array values.

**Handling:** Display as `[...]` or first few items. Full implementation deferred to v0.5+.

---

## UI Considerations

### Remove Step Inputs Section?

**Option A:** Keep both sections (Step Inputs + enhanced Input Schema)
- Pros: No information loss, backwards compatible
- Cons: Redundancy for fields that appear in both

**Option B:** Remove Step Inputs, rely on enhanced Input Schema
- Pros: Cleaner UI, single source of truth
- Cons: Loses visibility into dynamic fields not in schema

**Recommendation:** Option A initially. Evaluate removal after user feedback.

### Collapse by Default?

If Input Schema now shows values, it may be information-dense.

**Recommendation:** Keep current behavior (show first 3 fields, expand for more).

---

## Testing

### Unit Tests (`core/transformer.test.ts`)

```typescript
describe("extractSchemaFields with values", () => {
  it("should merge simple values into schema fields", () => {
    const schema = [{ name: "email", type: "string" }];
    const input = { email: "test@example.com" };
    const result = extractSchemaFields(schema, input);
    expect(result[0].value).toBe("test@example.com");
  });

  it("should simplify datapill values", () => {
    const schema = [{ name: "email", type: "string" }];
    const input = { email: '#{_dp(\'{"path":["parameters","email"],"line":"trigger"}\')}' };
    const result = extractSchemaFields(schema, input);
    expect(result[0].value).toBe("trigger.parameters.email");
  });

  it("should handle nested object values", () => {
    const schema = [{
      name: "result",
      type: "object",
      properties: [{ name: "id", type: "string" }]
    }];
    const input = { result: { id: "123" } };
    const result = extractSchemaFields(schema, input);
    expect(result[0].properties[0].value).toBe("123");
  });

  it("should handle missing values gracefully", () => {
    const schema = [{ name: "email", type: "string" }];
    const input = {};
    const result = extractSchemaFields(schema, input);
    expect(result[0].value).toBeUndefined();
  });

  it("should preserve optional flag for warning detection", () => {
    const schema = [
      { name: "email", type: "string", optional: false },
      { name: "phone", type: "string", optional: true }
    ];
    const input = {};
    const result = extractSchemaFields(schema, input);
    expect(result[0].optional).toBe(false);  // required, no value = warning
    expect(result[1].optional).toBe(true);   // optional, no value = ok
  });
});
```

### Manual Testing

1. Open `upsert_contact.recipe.json` - verify Salesforce action shows Email ← datapill
2. Open `ha_api_control_light.recipe.json` - verify HTTP action shows URL/method values
3. Verify callable triggers show schema without values (no false warnings for parameters)
4. Verify formulas display as `(formula)`
5. Verify long values truncate with tooltip
6. Test required field warnings:
   - Create/modify fixture with required field (`optional: false`) missing a value
   - Verify warning appears in section header: `⚠ 1 required field unmapped`
   - Verify inline ⚠ icon appears next to the specific field
   - Verify required fields WITH values don't show warning

---

## Migration Notes

- No breaking changes to existing IGM consumers
- `value` field is optional, so existing code continues to work
- UI gracefully handles missing values

---

## Design Decisions

### Required Fields Without Values

Show a warning for required fields that have no value assigned:

**Section header** (when applicable):
```
Input Schema (7) ⚠ 1 required field unmapped
```

**Inline indicator** on the specific field:
```
  ⚠ Email* (string)      —
    FirstName (string)   ← trigger.parameters.first_name
```

This provides:
- At-a-glance summary without expanding
- Easy identification of which specific fields need attention
- Accessibility-friendly (icon + text, not color-only)

### Field Count Display

Keep simple total count in header: `Input Schema (7)`

Only augment with warning when required fields are unmapped. Avoids false "incompleteness" signals for actions with many optional fields (e.g., Salesforce with 50+ fields where only 5 are typically used).

### Step Inputs Section

Keep the Step Inputs section for now. Evaluate after implementation whether it's redundant or still provides value for:
- Dynamic fields not in schema
- Quick flat view vs hierarchical schema view

---

## References

- `shared/types.ts` - SchemaField interface
- `core/transformer.ts` - extractSchemaFields(), simplifyValue()
- `webview-ui/src/NodeDetailsPanel.tsx` - SchemaSection, SchemaFieldRow
- `fixtures/upsert_contact.recipe.json` - Complex example with nested schemas
