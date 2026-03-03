/**
 * IGM Transformer - Converts Workato recipe JSON to IGM graph
 */

import {
  IgmNode,
  IgmEdge,
  IgmGraph,
  IgmNodeKind,
  IgmEdgeKind,
  SourceRef,
  StepMeta,
  NodeUi,
  TriggerType,
  RecipeMeta,
  RecipeConnection,
  Diagnostic,
  BuildOptions,
  SchemaField,
} from "../shared/types";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect trigger type from step metadata
 */
function getTriggerType(step: any): TriggerType {
  const provider = step.provider || "";
  const name = step.name || "";

  // API endpoint triggers
  if (provider === "workato_api_platform" && name === "receive_request") {
    return "api_endpoint";
  }

  // Callable recipe triggers
  if (provider === "workato_recipe_function" && name === "execute") {
    return "callable";
  }

  // Webhook triggers
  if (provider === "workato_webhook" || name.includes("webhook")) {
    return "webhook";
  }

  // Scheduler triggers
  if (provider === "clock" || name === "scheduled_event") {
    return "scheduler";
  }

  // Polling triggers (new/updated record patterns)
  if (name.startsWith("new_") || name.startsWith("updated_") || name.includes("_new_") || name.includes("_updated_")) {
    return "polling" as TriggerType;
  }

  // Real-time event triggers (Slack, etc.)
  if (name.includes("event") || name.includes("message") || name.includes("notification")) {
    return "event" as TriggerType;
  }

  return "unknown";
}

/**
 * Extract schema fields from extended_input_schema or extended_output_schema
 * Returns a simplified structure suitable for display in the details panel
 *
 * @param schema - The schema array from extended_input_schema or extended_output_schema
 * @param inputValues - Optional input values to merge into schema fields (for input schemas only)
 */
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

    // Add simplified value if present and not an object
    if (fieldValue !== undefined && fieldValue !== null) {
      if (typeof fieldValue !== "object") {
        result.value = simplifyValue(fieldValue);
      }
      // For objects, values are handled in nested properties
    }

    // Handle nested object properties
    if (field.properties && Array.isArray(field.properties)) {
      // Pass nested values for object fields
      const nestedValues = typeof fieldValue === "object" && fieldValue !== null
        ? fieldValue
        : undefined;
      result.properties = field.properties.map((p: any) => extractField(p, nestedValues));
    }

    return result;
  };

  return schema.map((field) => extractField(field, inputValues));
}

/**
 * Parse a stringified JSON schema (used in callable recipe triggers)
 * Returns SchemaField[] or undefined if parsing fails
 */
function parseJsonSchemaString(jsonString: string | undefined): SchemaField[] | undefined {
  if (!jsonString || typeof jsonString !== "string") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return extractSchemaFields(parsed);
  } catch {
    return undefined;
  }
}

/**
 * Check if a trigger is a callable recipe trigger
 */
function isCallableTrigger(step: any): boolean {
  return step.provider === "workato_recipe_function" && step.name === "execute";
}

/**
 * Check if step is an explicit terminal (return_response or return_result)
 */
function isExplicitTerminal(step: any): boolean {
  return (
    (step.provider === "workato_api_platform" && step.name === "return_response") ||
    (step.provider === "workato_recipe_function" && step.name === "return_result")
  );
}

/**
 * Check if step calls another recipe
 */
function isRecipeCall(step: any): boolean {
  return step.provider === "workato_recipe_function" && step.name === "call_recipe";
}

/**
 * Get display name for a provider
 */
function getProviderDisplayName(provider: string | undefined): string | undefined {
  if (!provider) return undefined;

  const KNOWN: Record<string, string> = {
    // Workato platform
    workato_api_platform: "API Platform",
    workato_recipe_function: "Recipe Function",
    workato_webhook: "Webhook",
    clock: "Scheduler",
    logger: "Logger",

    // CRM & Sales
    salesforce: "Salesforce",
    hubspot: "HubSpot",
    zendesk: "Zendesk",
    servicenow: "ServiceNow",
    dynamics_crm: "Dynamics 365",
    pipedrive: "Pipedrive",

    // Communication & Collaboration
    slack: "Slack",
    slack_bot: "Slack Bot",
    microsoft_teams: "Microsoft Teams",
    gmail: "Gmail",
    outlook: "Outlook",
    twilio: "Twilio",
    sendgrid: "SendGrid",

    // Payments & Finance
    stripe: "Stripe",
    quickbooks: "QuickBooks",
    xero: "Xero",
    netsuite: "NetSuite",
    sage_intacct: "Sage Intacct",

    // Databases
    postgresql: "PostgreSQL",
    mysql: "MySQL",
    mssql: "SQL Server",
    snowflake: "Snowflake",
    bigquery: "BigQuery",
    redshift: "Redshift",

    // Cloud & DevOps
    aws: "AWS",
    aws_s3: "AWS S3",
    aws_lambda: "AWS Lambda",
    azure: "Azure",
    gcp: "Google Cloud",
    github: "GitHub",
    jira: "Jira",

    // eCommerce & Marketing
    shopify: "Shopify",
    magento: "Magento",
    marketo: "Marketo",
    mailchimp: "Mailchimp",

    // ERP & Operations
    sap: "SAP",
    oracle: "Oracle",
    workday: "Workday",
    coupa: "Coupa",

    // File & Document
    box: "Box",
    dropbox: "Dropbox",
    google_drive: "Google Drive",
    sharepoint: "SharePoint",
    docusign: "DocuSign",

    // HTTP & Generic
    http: "HTTP",
    rest: "REST API",
    soap: "SOAP",
  };

  if (KNOWN[provider]) return KNOWN[provider];

  // Custom connector pattern: name__connector_XXXXX_XXXXX
  const customMatch = provider.match(/^(.+?)__connector_\d+_\d+$/);
  if (customMatch) {
    return customMatch[1]
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Fallback: Title case the provider name
  return provider
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Check if an object is an executable step
 */
function isExecutableStep(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  // else and catch are containers, not mainline executable steps
  if (obj.keyword === "else" || obj.keyword === "catch") return false;
  if (typeof obj.keyword === "string") return true;
  // Some recipes use provider+name without explicit keyword
  if (typeof obj.provider === "string" && typeof obj.name === "string") return true;
  return false;
}

/**
 * Generate node ID from step or pointer
 */
function getNodeId(step: any, jsonPointer: string): string {
  if (step.uuid) return step.uuid;
  return `ptr:${jsonPointer}`;
}

/**
 * Find connection name for a provider from recipe config
 */
function getConnectionName(config: any[] | undefined, provider: string | undefined): string | undefined {
  if (!config || !provider) return undefined;

  const connectionConfig = config.find(
    (c: any) => c.provider === provider && c.account_id?.name
  );

  return connectionConfig?.account_id?.name;
}

/**
 * Simplify a value for display
 */
function simplifyValue(value: any, maxLength: number = 50): string {
  let displayValue = String(value);

  // Simplify datapill references
  if (displayValue.includes("_dp(")) {
    // Only simplify to a clean reference for single, pure datapill values.
    // Pure interpolation: #{_dp('{...}')}
    // Pure formula:       =_dp('{...}')
    // Everything else (mixed text, multiple datapills, formulas) → "(formula)"
    const dpCount = (displayValue.match(/_dp\(/g) || []).length;
    const isPure = dpCount === 1 && (
      /^#\{_dp\('[^']*'\)\}$/.test(displayValue) ||
      /^=_dp\('[^']*'\)$/.test(displayValue)
    );

    if (isPure) {
      const match = displayValue.match(/"path":\s*\[([^\]]+)\]/);
      if (match) {
        const pathParts = match[1].replace(/"/g, "").split(",").map(s => s.trim());
        const line = displayValue.match(/"line":\s*"([^"]+)"/)?.[1] || "";
        displayValue = `${line}.${pathParts.join(".")}`;
      } else {
        displayValue = "(formula)";
      }
    } else {
      displayValue = "(formula)";
    }
  }

  // Truncate long values
  if (displayValue.length > maxLength) {
    displayValue = displayValue.substring(0, maxLength - 3) + "...";
  }

  return displayValue;
}

/**
 * Extract simplified input values for display
 * - Truncates long values
 * - Simplifies datapill references
 * - Extracts response body fields for return_response actions
 */
function extractStepInputs(input: any): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined;

  const result: Record<string, string> = {};
  const maxInputs = 12; // Limit number of inputs shown

  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (count >= maxInputs) break;

    // Skip internal fields
    if (key.startsWith("_")) continue;

    // Skip schema JSON fields (handled separately for callable recipes)
    if (key.endsWith("_schema_json")) continue;

    // Handle response body object specially (for return_response actions)
    if (key === "response" && typeof value === "object" && value !== null) {
      for (const [respKey, respValue] of Object.entries(value)) {
        if (count >= maxInputs) break;
        if (respKey.startsWith("_")) continue;

        // Skip complex nested objects but show simple values
        if (typeof respValue === "object" && respValue !== null) continue;

        result[`response.${respKey}`] = simplifyValue(respValue);
        count++;
      }
      continue;
    }

    // Skip other complex objects
    if (typeof value === "object") continue;

    result[key] = simplifyValue(value);
    count++;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Generate edge ID
 */
function makeEdgeId(kind: IgmEdgeKind, from: string, to: string): string {
  return `${kind}|${from}|${to}`;
}

// ============================================================================
// Build Context
// ============================================================================

// Partition values for swim lane layout
const PARTITION_CENTER = 0;  // Main flow axis
const PARTITION_UPPER = 1;   // Try body, Then body (above axis in ideal layout)
const PARTITION_LOWER = 2;   // Catch body, Else body (below axis in ideal layout)

interface BuildContext {
  nodes: IgmNode[];
  edges: IgmEdge[];
  diagnostics: Diagnostic[];
  aliasMap: Map<string, string>; // step.as → nodeId
  config?: any[]; // Recipe config for connection lookups
  partition: number; // Current partition for swim lane assignment
}

// ============================================================================
// Node Creation
// ============================================================================

function createTriggerNode(step: any, jsonPointer: string, config?: any[]): IgmNode {
  const id = getNodeId(step, jsonPointer);
  const connectionName = getConnectionName(config, step.provider);
  const inputs = extractStepInputs(step.input);

  // For callable triggers, extract schemas from JSON strings in input
  let inputSchema: SchemaField[] | undefined;
  let outputSchema: SchemaField[] | undefined;

  if (isCallableTrigger(step) && step.input) {
    inputSchema = parseJsonSchemaString(step.input.parameters_schema_json);
    outputSchema = parseJsonSchemaString(step.input.result_schema_json);
  }

  // Fall back to extended_output_schema if no result schema from JSON
  if (!outputSchema) {
    outputSchema = extractSchemaFields(step.extended_output_schema);
  }

  return {
    id,
    kind: "trigger",
    label: "trigger",
    source: { jsonPointer },
    step: {
      keyword: step.keyword,
      uuid: step.uuid,
      number: step.number,
      as: step.as,
      provider: step.provider,
      name: step.name,
      connectionName,
      inputs,
    },
    ui: {
      badge:
        step.provider && step.name
          ? `${getProviderDisplayName(step.provider)}.${step.name}`
          : undefined,
      triggerType: getTriggerType(step),
      hasInputSchema: !!inputSchema?.length,
      hasOutputSchema: !!outputSchema?.length,
    },
    inputSchema,
    outputSchema,
  };
}

function createActionNode(step: any, jsonPointer: string, config?: any[]): IgmNode {
  const id = getNodeId(step, jsonPointer);
  const isTerminal = isExplicitTerminal(step);
  const inputSchema = extractSchemaFields(step.extended_input_schema, step.input);
  const outputSchema = extractSchemaFields(step.extended_output_schema);
  const connectionName = getConnectionName(config, step.provider);
  const inputs = extractStepInputs(step.input);
  const recipeCall = isRecipeCall(step);

  // Build UI metadata
  const ui: NodeUi = {
    badge: getProviderDisplayName(step.provider),
    isTerminal,
    httpStatus: isTerminal ? step.input?.http_status_code : undefined,
    isRecipeCall: recipeCall,
    hasInputSchema: !!inputSchema?.length,
    hasOutputSchema: !!outputSchema?.length,
  };

  // Extract recipe reference for drill-down when it's a recipe call
  if (recipeCall && step.input?.flow_id) {
    const flowId = step.input.flow_id;
    ui.recipeCallRef = {
      zipName: flowId.zip_name,
      name: flowId.name,
      folder: flowId.folder,
    };
  }

  return {
    id,
    kind: "action",
    label: step.as ?? step.name ?? `action${step.number ? " " + step.number : ""}`,
    source: { jsonPointer },
    step: {
      keyword: step.keyword ?? "action",
      uuid: step.uuid,
      number: step.number,
      as: step.as,
      provider: step.provider,
      name: step.name,
      connectionName,
      inputs,
    },
    ui,
    inputSchema,
    outputSchema,
  };
}

function createIfNode(step: any, jsonPointer: string): IgmNode {
  const id = getNodeId(step, jsonPointer);
  return {
    id,
    kind: "if",
    label: step.as ?? "If",
    source: { jsonPointer },
    step: {
      keyword: "if",
      uuid: step.uuid,
      number: step.number,
      as: step.as,
    },
  };
}

function createTryNode(step: any, jsonPointer: string): IgmNode {
  const id = getNodeId(step, jsonPointer);
  return {
    id,
    kind: "try",
    label: step.as ?? "Try",
    source: { jsonPointer },
    step: {
      keyword: "try",
      uuid: step.uuid,
      number: step.number,
      as: step.as,
    },
  };
}

function createCatchNode(step: any, jsonPointer: string): IgmNode {
  const id = getNodeId(step, jsonPointer);
  return {
    id,
    kind: "catch",
    label: step.as ?? "Catch",
    source: { jsonPointer },
    step: {
      keyword: "catch",
      uuid: step.uuid,
      number: step.number,
      as: step.as,
      provider: null,
    },
  };
}

function createForeachNode(step: any, jsonPointer: string): IgmNode {
  const id = getNodeId(step, jsonPointer);
  return {
    id,
    kind: "foreach",
    label: step.as ?? "For Each",
    source: { jsonPointer },
    step: {
      keyword: "foreach",
      uuid: step.uuid,
      number: step.number,
      as: step.as,
    },
    ui: {
      // Store loop metadata for display
      loopSource: step.source,
      repeatMode: step.repeat_mode,
    },
  };
}

function createBranchNode(
  parentId: string,
  branchType: "then" | "else" | "catch",
  parentPointer: string,
  stepNumber?: number
): IgmNode {
  const id = `${parentId}::${branchType}`;
  const labelMap = { then: "Then", else: "Else", catch: "Catch" };
  return {
    id,
    kind: "branch",
    label: labelMap[branchType],
    source: { jsonPointer: parentPointer },
    step: stepNumber !== undefined ? { keyword: branchType, number: stepNumber } : undefined,
  };
}

function createEndNode(): IgmNode {
  return {
    id: "::end",
    kind: "end",
    label: "End",
    source: { jsonPointer: "/" },
  };
}

function createErrorNode(message: string, jsonPointer: string, step?: any): IgmNode {
  const id = step?.uuid ?? `error:${jsonPointer}`;
  return {
    id,
    kind: "error",
    label: step?.as ?? step?.name ?? "Error",
    source: { jsonPointer },
    ui: {
      badge: message,
    },
    step: step ? {
      keyword: step.keyword,
      uuid: step.uuid,
      number: step.number,
      as: step.as,
    } : undefined,
  };
}

// ============================================================================
// Block Traversal
// ============================================================================

interface TraversalResult {
  headNodeId: string | null;
  tailNodes: IgmNode[];
}

/**
 * Partition a block array into main steps and else/catch containers
 */
function partitionBlock(
  block: any[],
  containerKeyword: "else" | "catch"
): { mainSteps: any[]; container: any | null } {
  const mainSteps: any[] = [];
  let container: any | null = null;

  for (const item of block) {
    if (item.keyword === containerKeyword) {
      if (container) {
        // Multiple containers - take first, add diagnostic later
      } else {
        container = item;
      }
    } else {
      mainSteps.push(item);
    }
  }

  return { mainSteps, container };
}

/**
 * Process a sequence of steps and create sequential edges
 */
function processStepSequence(
  steps: any[],
  basePointer: string,
  ctx: BuildContext
): TraversalResult {
  if (steps.length === 0) {
    return { headNodeId: null, tailNodes: [] };
  }

  // Process each step once and collect head/tail info
  const results: TraversalResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const pointer = `${basePointer}/${i}`;
    results.push(processStep(step, pointer, ctx));
  }

  // Create sequential edges between steps
  for (let i = 0; i < results.length - 1; i++) {
    const current = results[i];
    const next = results[i + 1];

    if (next.headNodeId) {
      for (const tailNode of current.tailNodes) {
        // Don't create next edge from terminal nodes
        if (!tailNode.ui?.isTerminal) {
          // Determine edge kind based on node type and flags
          let edgeKind: IgmEdgeKind = "next";
          if (tailNode.kind === "foreach") {
            edgeKind = "exit";
          } else if (tailNode.kind === "if" && tailNode.ui?.needsFalseExit) {
            edgeKind = "false";
          }

          ctx.edges.push({
            id: makeEdgeId(edgeKind, tailNode.id, next.headNodeId),
            from: tailNode.id,
            to: next.headNodeId,
            kind: edgeKind,
          });
        }
      }
    }
  }

  // Return head of first step and tails of last step
  const firstHead = results.find((r) => r.headNodeId)?.headNodeId ?? null;
  const lastTails = results[results.length - 1]?.tailNodes ?? [];

  return { headNodeId: firstHead, tailNodes: lastTails };
}

/**
 * Process a single step and return head/tail info
 */
function processStep(step: any, jsonPointer: string, ctx: BuildContext): TraversalResult {
  // Handle null/undefined steps gracefully
  if (step === null || step === undefined) {
    ctx.diagnostics.push({
      level: "warn",
      message: "Null or undefined step encountered",
      source: { jsonPointer },
    });
    return { headNodeId: null, tailNodes: [] };
  }

  if (!isExecutableStep(step)) {
    return { headNodeId: null, tailNodes: [] };
  }

  const keyword = step.keyword;

  // Wrap processing in try/catch for error recovery
  try {
    switch (keyword) {
      case "trigger":
        return processTrigger(step, jsonPointer, ctx);
      case "action":
        return processAction(step, jsonPointer, ctx);
      case "if":
        return processIf(step, jsonPointer, ctx);
      case "try":
        return processTry(step, jsonPointer, ctx);
      case "foreach":
        return processForeach(step, jsonPointer, ctx);
      default:
        // Unknown keyword or provider+name without keyword
        if (step.provider && step.name) {
          return processAction(step, jsonPointer, ctx);
        }
        // Create error node for truly unknown steps
        const errorNode = createErrorNode(`Unknown keyword: ${keyword}`, jsonPointer, step);
        ctx.nodes.push(errorNode);
        ctx.diagnostics.push({
          level: "warn",
          message: `Unknown keyword: ${keyword}`,
          source: { jsonPointer },
        });
        return { headNodeId: errorNode.id, tailNodes: [errorNode] };
    }
  } catch (error) {
    // Create error node when processing fails
    const message = error instanceof Error ? error.message : "Processing failed";
    const errorNode = createErrorNode(message, jsonPointer, step);
    ctx.nodes.push(errorNode);
    ctx.diagnostics.push({
      level: "error",
      message: `Failed to process step: ${message}`,
      source: { jsonPointer },
    });
    return { headNodeId: errorNode.id, tailNodes: [errorNode] };
  }
}

function processTrigger(step: any, jsonPointer: string, ctx: BuildContext): TraversalResult {
  const node = createTriggerNode(step, jsonPointer, ctx.config);
  ctx.nodes.push(node);

  if (step.as) {
    ctx.aliasMap.set(step.as, node.id);
  }

  // Process nested block if present
  if (step.block && Array.isArray(step.block)) {
    const blockResult = processStepSequence(step.block, `${jsonPointer}/block`, ctx);

    if (blockResult.headNodeId) {
      ctx.edges.push({
        id: makeEdgeId("next", node.id, blockResult.headNodeId),
        from: node.id,
        to: blockResult.headNodeId,
        kind: "next",
      });
      return { headNodeId: node.id, tailNodes: blockResult.tailNodes };
    }
  }

  return { headNodeId: node.id, tailNodes: [node] };
}

function processAction(step: any, jsonPointer: string, ctx: BuildContext): TraversalResult {
  const node = createActionNode(step, jsonPointer, ctx.config);
  // Apply current partition for swim lane layout
  node.ui = { ...node.ui, partition: ctx.partition };
  ctx.nodes.push(node);

  if (step.as) {
    ctx.aliasMap.set(step.as, node.id);
  }

  return { headNodeId: node.id, tailNodes: [node] };
}

function processIf(step: any, jsonPointer: string, ctx: BuildContext): TraversalResult {
  const ifNode = createIfNode(step, jsonPointer);
  // If control node stays on center axis
  ifNode.ui = { ...ifNode.ui, partition: PARTITION_CENTER };
  ctx.nodes.push(ifNode);

  if (step.as) {
    ctx.aliasMap.set(step.as, ifNode.id);
  }

  const block = step.block ?? [];
  const { mainSteps: thenSteps, container: elseContainer } = partitionBlock(block, "else");

  // Create then branch node (upper partition)
  const thenBranch = createBranchNode(ifNode.id, "then", jsonPointer);
  thenBranch.ui = { ...thenBranch.ui, partition: PARTITION_UPPER };
  ctx.nodes.push(thenBranch);
  ctx.edges.push({
    id: makeEdgeId("true", ifNode.id, thenBranch.id),
    from: ifNode.id,
    to: thenBranch.id,
    kind: "true",
  });

  // Process then steps in UPPER partition
  const savedPartition = ctx.partition;
  ctx.partition = PARTITION_UPPER;
  const thenResult = processStepSequence(thenSteps, `${jsonPointer}/block`, ctx);
  ctx.partition = savedPartition;

  if (thenResult.headNodeId) {
    ctx.edges.push({
      id: makeEdgeId("next", thenBranch.id, thenResult.headNodeId),
      from: thenBranch.id,
      to: thenResult.headNodeId,
      kind: "next",
    });
  }

  const branchTails: IgmNode[] = [];
  if (thenResult.tailNodes.length > 0) {
    branchTails.push(...thenResult.tailNodes);
  } else {
    branchTails.push(thenBranch);
  }

  // Process else branch if present
  let elseBranch: IgmNode | null = null;
  if (elseContainer) {
    const elsePointer = `${jsonPointer}/block/${block.indexOf(elseContainer)}`;
    elseBranch = createBranchNode(ifNode.id, "else", elsePointer, elseContainer.number);
    // Else branch node in lower partition
    elseBranch.ui = { ...elseBranch.ui, partition: PARTITION_LOWER };
    ctx.nodes.push(elseBranch);
    ctx.edges.push({
      id: makeEdgeId("false", ifNode.id, elseBranch.id),
      from: ifNode.id,
      to: elseBranch.id,
      kind: "false",
    });

    // Process else steps in LOWER partition
    ctx.partition = PARTITION_LOWER;
    const elseSteps = elseContainer.block ?? [];
    const elseResult = processStepSequence(elseSteps, `${elsePointer}/block`, ctx);
    ctx.partition = savedPartition;

    if (elseResult.headNodeId) {
      ctx.edges.push({
        id: makeEdgeId("next", elseBranch.id, elseResult.headNodeId),
        from: elseBranch.id,
        to: elseResult.headNodeId,
        kind: "next",
      });
    }

    if (elseResult.tailNodes.length > 0) {
      branchTails.push(...elseResult.tailNodes);
    } else {
      branchTails.push(elseBranch);
    }
  }

  // Determine if we need a join node
  const nonTerminalTails = branchTails.filter((t) => !t.ui?.isTerminal);

  // Case 1: No else branch - the "no" path implicitly skips to next step
  // Don't create a join node; return ifNode as a tail so it connects via "false" edge
  if (!elseBranch) {
    // Mark ifNode to indicate it needs a "false" exit edge when connected to next step
    ifNode.ui = { ...ifNode.ui, needsFalseExit: true };
    // Return both the if node (for false path) and non-terminal then tails
    return { headNodeId: ifNode.id, tailNodes: [ifNode, ...nonTerminalTails] };
  }

  // Case 2: Has else branch with non-terminal tails - connect them directly to next step (no join)
  if (nonTerminalTails.length >= 1) {
    return { headNodeId: ifNode.id, tailNodes: nonTerminalTails };
  }

  // Case 3: All branches terminate - return terminal tails
  return { headNodeId: ifNode.id, tailNodes: branchTails.filter((t) => t.ui?.isTerminal) };
}

function processTry(step: any, jsonPointer: string, ctx: BuildContext): TraversalResult {
  const tryNode = createTryNode(step, jsonPointer);
  // Try control node stays on center axis
  tryNode.ui = { ...tryNode.ui, partition: PARTITION_CENTER };
  ctx.nodes.push(tryNode);

  if (step.as) {
    ctx.aliasMap.set(step.as, tryNode.id);
  }

  const block = step.block ?? [];
  const { mainSteps: trySteps, container: catchContainer } = partitionBlock(block, "catch");

  // Process try steps in UPPER partition (swim lane above axis)
  const savedPartition = ctx.partition;
  ctx.partition = PARTITION_UPPER;
  const tryResult = processStepSequence(trySteps, `${jsonPointer}/block`, ctx);
  ctx.partition = savedPartition;

  if (tryResult.headNodeId) {
    ctx.edges.push({
      id: makeEdgeId("next", tryNode.id, tryResult.headNodeId),
      from: tryNode.id,
      to: tryResult.headNodeId,
      kind: "next",
    });
  }

  const branchTails: IgmNode[] = [];
  if (tryResult.tailNodes.length > 0) {
    branchTails.push(...tryResult.tailNodes);
  } else {
    branchTails.push(tryNode);
  }

  // Process catch branch if present
  if (catchContainer) {
    const catchPointer = `${jsonPointer}/block/${block.indexOf(catchContainer)}`;
    const catchNode = createCatchNode(catchContainer, catchPointer);
    // Catch control node stays on center axis
    catchNode.ui = { ...catchNode.ui, partition: PARTITION_CENTER };
    ctx.nodes.push(catchNode);

    if (catchContainer.as) {
      ctx.aliasMap.set(catchContainer.as, catchNode.id);
    }

    ctx.edges.push({
      id: makeEdgeId("error", tryNode.id, catchNode.id),
      from: tryNode.id,
      to: catchNode.id,
      kind: "error",
    });

    // Process catch steps in LOWER partition (swim lane below axis)
    ctx.partition = PARTITION_LOWER;
    const catchSteps = catchContainer.block ?? [];
    const catchResult = processStepSequence(catchSteps, `${catchPointer}/block`, ctx);
    ctx.partition = savedPartition;

    if (catchResult.headNodeId) {
      ctx.edges.push({
        id: makeEdgeId("next", catchNode.id, catchResult.headNodeId),
        from: catchNode.id,
        to: catchResult.headNodeId,
        kind: "next",
      });
    }

    if (catchResult.tailNodes.length > 0) {
      branchTails.push(...catchResult.tailNodes);
    } else {
      branchTails.push(catchNode);
    }
  }

  // Determine tails - no join node, connect branches directly to next step
  const nonTerminalTails = branchTails.filter((t) => !t.ui?.isTerminal);

  if (nonTerminalTails.length >= 1) {
    return { headNodeId: tryNode.id, tailNodes: nonTerminalTails };
  }

  // All branches terminate
  return { headNodeId: tryNode.id, tailNodes: branchTails.filter((t) => t.ui?.isTerminal) };
}

function processForeach(step: any, jsonPointer: string, ctx: BuildContext): TraversalResult {
  const foreachNode = createForeachNode(step, jsonPointer);
  ctx.nodes.push(foreachNode);

  if (step.as) {
    ctx.aliasMap.set(step.as, foreachNode.id);
  }

  const block = step.block ?? [];

  // Process loop body steps
  const bodyResult = processStepSequence(block, `${jsonPointer}/block`, ctx);

  if (bodyResult.headNodeId) {
    // Connect foreach to first step in body (use loop edge for visual consistency)
    ctx.edges.push({
      id: makeEdgeId("loop", foreachNode.id, bodyResult.headNodeId),
      from: foreachNode.id,
      to: bodyResult.headNodeId,
      kind: "loop",
    });

    // Connect body tails back to foreach (loop edge)
    for (const tail of bodyResult.tailNodes) {
      if (!tail.ui?.isTerminal) {
        ctx.edges.push({
          id: makeEdgeId("loop", tail.id, foreachNode.id),
          from: tail.id,
          to: foreachNode.id,
          kind: "loop",
        });
      }
    }
  }

  // Foreach itself is the exit point - no separate join needed
  // The next step after foreach will connect directly to the foreach node
  return { headNodeId: foreachNode.id, tailNodes: [foreachNode] };
}

// ============================================================================
// Recipe Metadata Extraction
// ============================================================================

function extractRecipeMeta(recipe: any): RecipeMeta {
  const connections: RecipeConnection[] = (recipe.config ?? [])
    .filter((c: any) => c.keyword === "application")
    .map((c: any) => ({
      provider: c.provider,
      displayName: getProviderDisplayName(c.provider) ?? c.provider,
      connectionName: c.account_id?.name,
    }));

  return {
    name: recipe.name ?? "Untitled Recipe",
    version: recipe.version ?? 1,
    private: recipe.private ?? true,
    concurrency: recipe.concurrency ?? 1,
    connections,
  };
}

// ============================================================================
// Main Build Function
// ============================================================================

/**
 * Build a minimal graph with just an error node and end node
 * Used when validation fails or processing encounters fatal errors
 */
function buildMinimalGraph(ctx: BuildContext, errorLabel: string): IgmGraph {
  const errorNode: IgmNode = {
    id: "::error",
    kind: "error",
    label: errorLabel,
    source: { jsonPointer: "/" },
    ui: {
      badge: ctx.diagnostics[ctx.diagnostics.length - 1]?.message ?? "Error",
    },
  };

  const endNode = createEndNode();

  return {
    nodes: [errorNode, endNode],
    edges: [
      {
        id: "error|::error|::end",
        from: "::error",
        to: "::end",
        kind: "next",
      },
    ],
    roots: ["::error"],
    meta: {
      name: "Invalid Recipe",
      version: 1,
      private: true,
      concurrency: 1,
      connections: [],
    },
    diagnostics: ctx.diagnostics,
  };
}

export function buildIgm(recipeJson: unknown, _opts?: BuildOptions): IgmGraph {
  const ctx: BuildContext = {
    nodes: [],
    edges: [],
    diagnostics: [],
    aliasMap: new Map(),
    config: undefined,
    partition: PARTITION_CENTER,  // Start on center axis
  };

  // Validate input
  if (recipeJson === null || recipeJson === undefined) {
    ctx.diagnostics.push({
      level: "error",
      message: "Recipe JSON is null or undefined",
      source: { jsonPointer: "/" },
    });
    return buildMinimalGraph(ctx, "Empty recipe");
  }

  if (typeof recipeJson !== "object") {
    ctx.diagnostics.push({
      level: "error",
      message: `Recipe JSON must be an object, got ${typeof recipeJson}`,
      source: { jsonPointer: "/" },
    });
    return buildMinimalGraph(ctx, "Invalid recipe type");
  }

  const recipe = recipeJson as any;
  ctx.config = recipe.config;

  // Validate required fields
  if (!recipe.code) {
    ctx.diagnostics.push({
      level: "error",
      message: "Recipe is missing required 'code' field",
      source: { jsonPointer: "/" },
    });
    return buildMinimalGraph(ctx, "Missing code block");
  }

  // 1. Traverse recipe.code
  let rootId: string | null = null;
  try {
    const result = processStep(recipe.code, "/code", ctx);
    rootId = result.headNodeId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.diagnostics.push({
      level: "error",
      message: `Failed to process recipe: ${message}`,
      source: { jsonPointer: "/code" },
    });
    return buildMinimalGraph(ctx, "Processing failed");
  }

  // 2. Add ::end node
  const endNode = createEndNode();
  ctx.nodes.push(endNode);

  // 3. Connect terminal nodes to ::end
  for (const node of ctx.nodes) {
    if (node.ui?.isTerminal) {
      ctx.edges.push({
        id: makeEdgeId("terminal", node.id, "::end"),
        from: node.id,
        to: "::end",
        kind: "terminal",
      });
    }
  }

  // 4. Connect dangling nodes to ::end
  const nodesWithOutgoing = new Set(ctx.edges.map((e) => e.from));
  for (const node of ctx.nodes) {
    if (node.id === "::end") continue;
    if (node.ui?.isTerminal) continue;

    if (!nodesWithOutgoing.has(node.id)) {
      ctx.edges.push({
        id: makeEdgeId("next", node.id, "::end"),
        from: node.id,
        to: "::end",
        kind: "next",
      });
    }
  }

  // 5. Extract metadata
  const meta = extractRecipeMeta(recipe);

  return {
    nodes: ctx.nodes,
    edges: ctx.edges,
    roots: rootId ? [rootId] : [],
    meta,
    diagnostics: ctx.diagnostics.length > 0 ? ctx.diagnostics : undefined,
  };
}
