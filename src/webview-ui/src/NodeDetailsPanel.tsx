import { useState } from "react";
import { IgmNode, SchemaField } from "../../shared/types";

interface NodeDetailsPanelProps {
  node: IgmNode | null;
  onClose: () => void;
  onNavigateToSource?: (node: IgmNode) => void;
  onOpenCalledRecipe?: (zipName: string, recipeName?: string) => void;
}

export function NodeDetailsPanel({ node, onClose, onNavigateToSource, onOpenCalledRecipe }: NodeDetailsPanelProps) {
  if (!node) return null;

  return (
    <div className="node-details-panel">
      <div className="node-details-header">
        <div className="node-details-title">
          <span className={`node-kind-badge ${node.kind}`}>{node.kind}</span>
          <span className="node-label">{node.label}</span>
        </div>
        <div className="header-actions">
          {onNavigateToSource && node.source?.jsonPointer && (
            <button
              className="go-to-code-button"
              onClick={() => onNavigateToSource(node)}
              title="Show code in editor"
            >
              Show code
            </button>
          )}
          {node.ui?.isRecipeCall && node.ui?.recipeCallRef?.zipName && onOpenCalledRecipe && (
            <button
              className="open-recipe-button"
              onClick={() => onOpenCalledRecipe(
                node.ui!.recipeCallRef!.zipName!,
                node.ui!.recipeCallRef?.name || node.label
              )}
              title={`Open ${node.ui.recipeCallRef.name || 'called recipe'}`}
            >
              Open recipe
            </button>
          )}
          <button className="close-button" onClick={onClose} title="Close">
            &times;
          </button>
        </div>
      </div>

      <div className="node-details-content">
        {/* Provider/Badge */}
        {node.ui?.badge && (
          <DetailRow label="Provider" value={node.ui.badge} />
        )}

        {/* HTTP Status for terminals */}
        {node.ui?.httpStatus && (
          <DetailRow
            label="HTTP Status"
            value={node.ui.httpStatus}
            valueClass={`http-status status-${getStatusClass(node.ui.httpStatus)}`}
          />
        )}

        {/* Trigger Type */}
        {node.ui?.triggerType && (
          <DetailRow label="Trigger Type" value={formatTriggerType(node.ui.triggerType)} />
        )}

        {/* Connection */}
        {node.step?.connectionName && (
          <DetailRow label="Connection" value={node.step.connectionName} />
        )}

        {/* Step Metadata */}
        {node.step && (
          <>
            <div className="section-divider" />
            <div className="section-title">Step Details</div>

            {node.step.keyword && (
              <DetailRow label="Keyword" value={node.step.keyword} mono />
            )}
            {node.step.provider && (
              <DetailRow label="Provider" value={node.step.provider} mono />
            )}
            {node.step.name && (
              <DetailRow label="Action" value={node.step.name} mono />
            )}
            {node.step.uuid && (
              <DetailRow label="UUID" value={node.step.uuid} mono small />
            )}
            {node.step.number !== undefined && (
              <DetailRow label="Step #" value={String(node.step.number)} />
            )}
            {node.step.as && (
              <DetailRow label="Output As" value={node.step.as} mono />
            )}
          </>
        )}

        {/* Step Inputs */}
        {node.step?.inputs && Object.keys(node.step.inputs).length > 0 && (
          <InputsSection inputs={node.step.inputs} />
        )}

        {/* Input Schema */}
        {node.inputSchema && node.inputSchema.length > 0 && (
          <SchemaSection title="Input Schema" fields={node.inputSchema} variant="input" />
        )}

        {/* Output Schema */}
        {node.outputSchema && node.outputSchema.length > 0 && (
          <SchemaSection title="Output Schema" fields={node.outputSchema} variant="output" />
        )}

        {/* Flags */}
        {(node.ui?.isTerminal || node.ui?.isRecipeCall) && (
          <>
            <div className="section-divider" />
            <div className="section-title">Flags</div>
            <div className="flag-badges">
              {node.ui?.isTerminal && (
                <span className="flag-badge terminal">Terminal</span>
              )}
              {node.ui?.isRecipeCall && (
                <span className="flag-badge recipe-call">Calls Recipe</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  valueClass?: string;
}

function DetailRow({ label, value, mono, small, valueClass }: DetailRowProps) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? "mono" : ""} ${small ? "small" : ""} ${valueClass || ""}`}>
        {value}
      </span>
    </div>
  );
}

function getStatusClass(status: string): string {
  const code = parseInt(status, 10);
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500) return "5xx";
  return "unknown";
}

function formatTriggerType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Schema Components
// ============================================================================

interface SchemaSectionProps {
  title: string;
  fields: SchemaField[];
  variant: "input" | "output";
}

/**
 * Count required fields without values (recursively includes nested properties)
 */
function countUnmappedRequired(fields: SchemaField[]): number {
  return fields.reduce((count, field) => {
    const isRequired = field.optional === false;
    const hasValue = field.value !== undefined;
    const unmapped = isRequired && !hasValue ? 1 : 0;
    const nestedCount = field.properties ? countUnmappedRequired(field.properties) : 0;
    return count + unmapped + nestedCount;
  }, 0);
}

function SchemaSection({ title, fields, variant }: SchemaSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Show preview of first few fields when collapsed
  const previewCount = 3;
  const hasMore = fields.length > previewCount;
  const displayFields = isExpanded ? fields : fields.slice(0, previewCount);

  // Count unmapped required fields (only for input schemas)
  const unmappedRequiredCount = variant === "input" ? countUnmappedRequired(fields) : 0;

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
            ⚠ {unmappedRequiredCount} required field{unmappedRequiredCount > 1 ? "s" : ""} blank
          </span>
        )}
        {hasMore && (
          <span className="expand-indicator">{isExpanded ? "▼" : "▶"}</span>
        )}
      </div>
      <div className="schema-fields">
        {displayFields.map((field, index) => (
          <SchemaFieldRow key={`${field.name}-${index}`} field={field} depth={0} />
        ))}
        {!isExpanded && hasMore && (
          <div
            className="schema-more"
            onClick={() => setIsExpanded(true)}
          >
            +{fields.length - previewCount} more fields...
          </div>
        )}
      </div>
    </>
  );
}

interface SchemaFieldRowProps {
  field: SchemaField;
  depth: number;
}

function SchemaFieldRow({ field, depth }: SchemaFieldRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = field.properties && field.properties.length > 0;
  const maxDepth = 2; // Limit nesting depth for readability

  const isRequired = field.optional === false;
  const hasValue = field.value !== undefined;
  const showWarning = isRequired && !hasValue;

  return (
    <div className="schema-field" style={{ marginLeft: depth * 12 }}>
      <div
        className={`schema-field-row ${hasChildren ? "expandable" : ""} ${showWarning ? "warning" : ""}`}
        onClick={hasChildren ? () => setIsExpanded(!isExpanded) : undefined}
      >
        {showWarning && (
          <span className="field-warning-icon" title="Required field is blank">⚠</span>
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
      {isExpanded && hasChildren && depth < maxDepth && (
        <div className="schema-field-children">
          {field.properties!.map((child, index) => (
            <SchemaFieldRow key={`${child.name}-${index}`} field={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Inputs Component
// ============================================================================

interface InputsSectionProps {
  inputs: Record<string, string>;
}

function InputsSection({ inputs }: InputsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const entries = Object.entries(inputs);
  const previewCount = 3;
  const hasMore = entries.length > previewCount;
  const displayEntries = isExpanded ? entries : entries.slice(0, previewCount);

  return (
    <>
      <div className="section-divider" />
      <div
        className="section-title section-title-clickable"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="inputs-indicator" />
        Step Inputs
        <span className="field-count">({entries.length})</span>
        {hasMore && (
          <span className="expand-indicator">{isExpanded ? "▼" : "▶"}</span>
        )}
      </div>
      <div className="inputs-list">
        {displayEntries.map(([key, value]) => (
          <div key={key} className="input-row">
            <span className="input-key">{key}</span>
            <span className="input-value" title={value}>{value}</span>
          </div>
        ))}
        {!isExpanded && hasMore && (
          <div className="schema-more" onClick={() => setIsExpanded(true)}>
            +{entries.length - previewCount} more inputs...
          </div>
        )}
      </div>
    </>
  );
}
