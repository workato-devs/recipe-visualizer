/**
 * IGM (Intermediate Graph Model) Types - v1.2
 * Workato recipe-shaped JSON → IGM for workflow visualization
 */

// ============================================================================
// Node Kinds
// ============================================================================

export type IgmNodeKind =
  | "trigger"
  | "action"
  | "if"
  | "else"
  | "try"
  | "catch"
  | "foreach"
  // Virtual/grouping nodes
  | "branch"
  | "end"
  // Error indicator
  | "error";

// ============================================================================
// Edge Kinds
// ============================================================================

export type IgmEdgeKind =
  | "next"      // Sequential execution in a block array
  | "true"      // if → then branch entry
  | "false"     // if → else branch entry
  | "error"     // try → catch branch entry
  | "loop"      // foreach loop-back edge
  | "exit"      // foreach exit edge (loop complete)
  | "terminal"  // Explicit return to ::end node
  | "data";     // Datapill-derived dependency (optional)

// ============================================================================
// Source Mapping
// ============================================================================

export interface SourceRef {
  /** JSON Pointer into the recipe document, e.g. /code/block/0/block/2 */
  jsonPointer: string;

  /** Optional: editor range if computed */
  range?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}

// ============================================================================
// Step Metadata
// ============================================================================

export interface StepMeta {
  keyword: string;
  uuid?: string;
  number?: number;
  as?: string;
  provider?: string | null;
  name?: string;
  /** Connection name used by this step (if any) */
  connectionName?: string;
  /** Key input values for this step (simplified for display) */
  inputs?: Record<string, string>;
}

// ============================================================================
// Schema Types
// ============================================================================

export interface SchemaField {
  name: string;
  label?: string;
  type: string;
  optional?: boolean;
  properties?: SchemaField[];  // For nested object fields
  value?: string;              // Actual input value (simplified for display)
}

// ============================================================================
// UI Metadata
// ============================================================================

export type TriggerType =
  | "api_endpoint"
  | "callable"
  | "genie_skill"
  | "data_table"
  | "event_streams"
  | "webhook"
  | "scheduler"
  | "polling"
  | "event"
  | "unknown";

/**
 * Reference to a called recipe for drill-down navigation
 */
export interface RecipeCallRef {
  /** Relative path to recipe file (e.g., "folder/recipe_name.recipe.json") */
  zipName?: string;
  /** Human-readable recipe name */
  name?: string;
  /** Folder containing the recipe */
  folder?: string;
}

export interface NodeUi {
  /** Display badge (provider/action hint) */
  badge?: string;

  /** Collapse state hint */
  collapsedByDefault?: boolean;

  /** Marks node as an explicit termination point */
  isTerminal?: boolean;

  /** Partition for swim lane layout (0=center, 1=upper, 2=lower) */
  partition?: number;

  /** HTTP status code for return_response actions */
  httpStatus?: string;

  /** Trigger type classification */
  triggerType?: TriggerType;

  /** Indicates this action calls another recipe */
  isRecipeCall?: boolean;

  /** Recipe reference for drill-down (only when isRecipeCall is true) */
  recipeCallRef?: RecipeCallRef;

  /** Schema presence flags */
  hasInputSchema?: boolean;
  hasOutputSchema?: boolean;

  /** Stop block: whether stop_with_error is true */
  stopWithError?: boolean;

  /** Stop block: reason text from stop_reason input */
  stopReason?: string;

  /** Foreach loop source expression (datapill) */
  loopSource?: string;

  /** Foreach repeat mode (e.g., "simple", "batch") */
  repeatMode?: string;

  /** Internal: if node needs "false" edge to next step (no else branch) */
  needsFalseExit?: boolean;
}

// ============================================================================
// Nodes and Edges
// ============================================================================

export interface IgmNode {
  id: string;
  kind: IgmNodeKind;
  label: string;
  source: SourceRef;
  step?: StepMeta;
  ui?: NodeUi;
  inputSchema?: SchemaField[];
  outputSchema?: SchemaField[];
}

export interface IgmEdge {
  id: string;
  from: string;
  to: string;
  kind: IgmEdgeKind;
  label?: string;
}

// ============================================================================
// Graph Container
// ============================================================================

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

export interface Diagnostic {
  level: "info" | "warn" | "error";
  message: string;
  source?: SourceRef;
}

export interface IgmGraph {
  nodes: IgmNode[];
  edges: IgmEdge[];
  roots: string[];

  /** Recipe-level metadata for sidebar display */
  meta?: RecipeMeta;

  diagnostics?: Diagnostic[];
}

// ============================================================================
// Build Options
// ============================================================================

export interface BuildOptions {
  /** Enable datapill-derived data edges (default: false) */
  enableDataEdges?: boolean;
}
