"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// extension/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// extension/RecipeVisualizerPanel.ts
var vscode2 = __toESM(require("vscode"));

// core/transformer.ts
function getTriggerType(step) {
  const provider = step.provider || "";
  const name = step.name || "";
  if (provider === "workato_api_platform" && name === "receive_request") {
    return "api_endpoint";
  }
  if (provider === "workato_recipe_function" && name === "execute") {
    return "callable";
  }
  if (provider === "workato_genie" && name === "start_workflow") {
    return "genie_skill";
  }
  if (provider === "workato_db_table") {
    return "data_table";
  }
  if (provider === "workato_pub_sub") {
    return "event_streams";
  }
  if (provider === "workato_webhook" || name.includes("webhook")) {
    return "webhook";
  }
  if (provider === "clock" || name === "scheduled_event") {
    return "scheduler";
  }
  if (name.startsWith("new_") || name.startsWith("updated_") || name.includes("_new_") || name.includes("_updated_")) {
    return "polling";
  }
  if (name.includes("event") || name.includes("message") || name.includes("notification")) {
    return "event";
  }
  return "unknown";
}
function extractSchemaFields(schema, inputValues) {
  if (!schema || !Array.isArray(schema) || schema.length === 0) {
    return void 0;
  }
  const extractField = (field, values) => {
    const fieldValue = values?.[field.name];
    const result = {
      name: field.name || "unknown",
      label: field.label,
      type: field.type || "string",
      optional: field.optional
    };
    if (fieldValue !== void 0 && fieldValue !== null) {
      if (typeof fieldValue !== "object") {
        result.value = simplifyValue(fieldValue);
      }
    }
    if (field.properties && Array.isArray(field.properties)) {
      const nestedValues = typeof fieldValue === "object" && fieldValue !== null ? fieldValue : void 0;
      result.properties = field.properties.map((p) => extractField(p, nestedValues));
    }
    return result;
  };
  return schema.map((field) => extractField(field, inputValues));
}
function parseJsonSchemaString(jsonString) {
  if (!jsonString || typeof jsonString !== "string") {
    return void 0;
  }
  try {
    const parsed = JSON.parse(jsonString);
    return extractSchemaFields(parsed);
  } catch {
    return void 0;
  }
}
function isCallableTrigger(step) {
  return step.provider === "workato_recipe_function" && step.name === "execute";
}
function isGenieSkillTrigger(step) {
  return step.provider === "workato_genie" && step.name === "start_workflow";
}
function isExplicitTerminal(step) {
  return step.provider === "workato_api_platform" && step.name === "return_response" || step.provider === "workato_recipe_function" && step.name === "return_result" || step.provider === "workato_genie" && step.name === "workflow_return_result" || step.keyword === "stop";
}
function isRecipeCall(step) {
  return step.provider === "workato_recipe_function" && step.name === "call_recipe";
}
function getProviderDisplayName(provider) {
  if (!provider)
    return void 0;
  const KNOWN = {
    // Workato platform
    workato_api_platform: "API Platform",
    workato_recipe_function: "Recipe Function",
    workato_genie: "Genie",
    workato_db_table: "Data Table",
    workato_pub_sub: "Event Streams",
    workato_variable: "Variable",
    workato_webhook: "Webhook",
    py_eval: "Python",
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
    slack_bot: "Slack",
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
    soap: "SOAP"
  };
  if (KNOWN[provider])
    return KNOWN[provider];
  const customMatch = provider.match(/^(.+?)__connector_\d+_\d+$/);
  if (customMatch) {
    return customMatch[1].replace(/_/g, " ").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }
  return provider.replace(/_/g, " ").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
function isExecutableStep(obj) {
  if (!obj || typeof obj !== "object")
    return false;
  if (obj.keyword === "else" || obj.keyword === "catch")
    return false;
  if (typeof obj.keyword === "string")
    return true;
  if (typeof obj.provider === "string" && typeof obj.name === "string")
    return true;
  return false;
}
function getNodeId(step, jsonPointer) {
  if (step.uuid)
    return step.uuid;
  return `ptr:${jsonPointer}`;
}
function getConnectionName(config, provider) {
  if (!config || !provider)
    return void 0;
  const connectionConfig = config.find(
    (c) => c.provider === provider && c.account_id?.name
  );
  return connectionConfig?.account_id?.name;
}
function simplifyValue(value, maxLength = 50) {
  let displayValue = String(value);
  if (displayValue.includes("_dp(")) {
    const dpCount = (displayValue.match(/_dp\(/g) || []).length;
    const isPure = dpCount === 1 && (/^#\{_dp\('[^']*'\)\}$/.test(displayValue) || /^=_dp\('[^']*'\)$/.test(displayValue));
    if (isPure) {
      const match = displayValue.match(/"path":\s*\[([^\]]+)\]/);
      if (match) {
        const pathParts = match[1].replace(/"/g, "").split(",").map((s) => s.trim());
        const line = displayValue.match(/"line":\s*"([^"]+)"/)?.[1] || "";
        displayValue = `${line}.${pathParts.join(".")}`;
      } else {
        displayValue = "(formula)";
      }
    } else {
      displayValue = "(formula)";
    }
  }
  if (displayValue.length > maxLength) {
    displayValue = displayValue.substring(0, maxLength - 3) + "...";
  }
  return displayValue;
}
function extractStepInputs(input) {
  if (!input || typeof input !== "object")
    return void 0;
  const result = {};
  const maxInputs = 12;
  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (count >= maxInputs)
      break;
    if (key.startsWith("_"))
      continue;
    if (key.endsWith("_schema_json"))
      continue;
    if ((key === "response" || key === "result") && typeof value === "object" && value !== null) {
      for (const [respKey, respValue] of Object.entries(value)) {
        if (count >= maxInputs)
          break;
        if (respKey.startsWith("_"))
          continue;
        if (typeof respValue === "object" && respValue !== null)
          continue;
        result[`${key}.${respKey}`] = simplifyValue(respValue);
        count++;
      }
      continue;
    }
    if (typeof value === "object")
      continue;
    result[key] = simplifyValue(value);
    count++;
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
function makeEdgeId(kind, from, to) {
  return `${kind}|${from}|${to}`;
}
var PARTITION_CENTER = 0;
var PARTITION_UPPER = 1;
var PARTITION_LOWER = 2;
function createTriggerNode(step, jsonPointer, config) {
  const id = getNodeId(step, jsonPointer);
  const connectionName = getConnectionName(config, step.provider);
  const inputs = extractStepInputs(step.input);
  let inputSchema;
  let outputSchema;
  if (isCallableTrigger(step) && step.input) {
    inputSchema = parseJsonSchemaString(step.input.parameters_schema_json);
    outputSchema = parseJsonSchemaString(step.input.result_schema_json);
  } else if (isGenieSkillTrigger(step) && step.input) {
    inputSchema = parseJsonSchemaString(step.input.input_schema);
    outputSchema = parseJsonSchemaString(step.input.output_schema);
  }
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
      inputs
    },
    ui: {
      badge: step.provider && step.name ? `${getProviderDisplayName(step.provider)}.${step.name}` : void 0,
      triggerType: getTriggerType(step),
      hasInputSchema: !!inputSchema?.length,
      hasOutputSchema: !!outputSchema?.length
    },
    inputSchema,
    outputSchema
  };
}
function createActionNode(step, jsonPointer, config) {
  const id = getNodeId(step, jsonPointer);
  const isTerminal = isExplicitTerminal(step);
  const inputSchema = extractSchemaFields(step.extended_input_schema, step.input);
  const outputSchema = extractSchemaFields(step.extended_output_schema);
  const connectionName = getConnectionName(config, step.provider);
  const inputs = extractStepInputs(step.input);
  const recipeCall = isRecipeCall(step);
  const isStop = step.keyword === "stop";
  const ui = {
    badge: getProviderDisplayName(step.provider),
    isTerminal,
    httpStatus: isTerminal ? step.input?.http_status_code : void 0,
    isRecipeCall: recipeCall,
    hasInputSchema: !!inputSchema?.length,
    hasOutputSchema: !!outputSchema?.length,
    stopWithError: isStop ? step.input?.stop_with_error === "true" : void 0,
    stopReason: isStop ? step.input?.stop_reason : void 0
  };
  if (recipeCall && step.input?.flow_id) {
    const flowId = step.input.flow_id;
    ui.recipeCallRef = {
      zipName: flowId.zip_name,
      name: flowId.name,
      folder: flowId.folder
    };
  }
  return {
    id,
    kind: "action",
    label: step.as ?? step.name ?? (isStop ? "Stop" : `action${step.number ? " " + step.number : ""}`),
    source: { jsonPointer },
    step: {
      keyword: step.keyword ?? "action",
      uuid: step.uuid,
      number: step.number,
      as: step.as,
      provider: step.provider,
      name: step.name,
      connectionName,
      inputs
    },
    ui,
    inputSchema,
    outputSchema
  };
}
function createIfNode(step, jsonPointer) {
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
      as: step.as
    }
  };
}
function createTryNode(step, jsonPointer) {
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
      as: step.as
    }
  };
}
function createCatchNode(step, jsonPointer) {
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
      provider: null
    }
  };
}
function createForeachNode(step, jsonPointer) {
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
      as: step.as
    },
    ui: {
      // Store loop metadata for display
      loopSource: step.source,
      repeatMode: step.repeat_mode
    }
  };
}
function createBranchNode(parentId, branchType, parentPointer, stepNumber) {
  const id = `${parentId}::${branchType}`;
  const labelMap = { then: "Then", else: "Else", catch: "Catch" };
  return {
    id,
    kind: "branch",
    label: labelMap[branchType],
    source: { jsonPointer: parentPointer },
    step: stepNumber !== void 0 ? { keyword: branchType, number: stepNumber } : void 0
  };
}
function createEndNode() {
  return {
    id: "::end",
    kind: "end",
    label: "End",
    source: { jsonPointer: "/" }
  };
}
function createErrorNode(message, jsonPointer, step) {
  const id = step?.uuid ?? `error:${jsonPointer}`;
  return {
    id,
    kind: "error",
    label: step?.as ?? step?.name ?? "Error",
    source: { jsonPointer },
    ui: {
      badge: message
    },
    step: step ? {
      keyword: step.keyword,
      uuid: step.uuid,
      number: step.number,
      as: step.as
    } : void 0
  };
}
function partitionBlock(block, containerKeyword) {
  const mainSteps = [];
  let container = null;
  for (const item of block) {
    if (item.keyword === containerKeyword) {
      if (container) {
      } else {
        container = item;
      }
    } else {
      mainSteps.push(item);
    }
  }
  return { mainSteps, container };
}
function processStepSequence(steps, basePointer, ctx) {
  if (steps.length === 0) {
    return { headNodeId: null, tailNodes: [] };
  }
  const results = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const pointer = `${basePointer}/${i}`;
    results.push(processStep(step, pointer, ctx));
  }
  for (let i = 0; i < results.length - 1; i++) {
    const current = results[i];
    const next = results[i + 1];
    if (next.headNodeId) {
      for (const tailNode of current.tailNodes) {
        if (!tailNode.ui?.isTerminal) {
          let edgeKind = "next";
          if (tailNode.kind === "foreach") {
            edgeKind = "exit";
          } else if (tailNode.kind === "if" && tailNode.ui?.needsFalseExit) {
            edgeKind = "false";
          }
          ctx.edges.push({
            id: makeEdgeId(edgeKind, tailNode.id, next.headNodeId),
            from: tailNode.id,
            to: next.headNodeId,
            kind: edgeKind
          });
        }
      }
    }
  }
  const firstHead = results.find((r) => r.headNodeId)?.headNodeId ?? null;
  const lastTails = results[results.length - 1]?.tailNodes ?? [];
  return { headNodeId: firstHead, tailNodes: lastTails };
}
function processStep(step, jsonPointer, ctx) {
  if (step === null || step === void 0) {
    ctx.diagnostics.push({
      level: "warn",
      message: "Null or undefined step encountered",
      source: { jsonPointer }
    });
    return { headNodeId: null, tailNodes: [] };
  }
  if (!isExecutableStep(step)) {
    return { headNodeId: null, tailNodes: [] };
  }
  const keyword = step.keyword;
  try {
    switch (keyword) {
      case "trigger":
        return processTrigger(step, jsonPointer, ctx);
      case "action":
      case "stop":
        return processAction(step, jsonPointer, ctx);
      case "if":
        return processIf(step, jsonPointer, ctx);
      case "try":
        return processTry(step, jsonPointer, ctx);
      case "foreach":
        return processForeach(step, jsonPointer, ctx);
      default:
        if (step.provider && step.name) {
          return processAction(step, jsonPointer, ctx);
        }
        const errorNode = createErrorNode(`Unknown keyword: ${keyword}`, jsonPointer, step);
        ctx.nodes.push(errorNode);
        ctx.diagnostics.push({
          level: "warn",
          message: `Unknown keyword: ${keyword}`,
          source: { jsonPointer }
        });
        return { headNodeId: errorNode.id, tailNodes: [errorNode] };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    const errorNode = createErrorNode(message, jsonPointer, step);
    ctx.nodes.push(errorNode);
    ctx.diagnostics.push({
      level: "error",
      message: `Failed to process step: ${message}`,
      source: { jsonPointer }
    });
    return { headNodeId: errorNode.id, tailNodes: [errorNode] };
  }
}
function processTrigger(step, jsonPointer, ctx) {
  const node = createTriggerNode(step, jsonPointer, ctx.config);
  ctx.nodes.push(node);
  if (step.as) {
    ctx.aliasMap.set(step.as, node.id);
  }
  if (step.block && Array.isArray(step.block)) {
    const blockResult = processStepSequence(step.block, `${jsonPointer}/block`, ctx);
    if (blockResult.headNodeId) {
      ctx.edges.push({
        id: makeEdgeId("next", node.id, blockResult.headNodeId),
        from: node.id,
        to: blockResult.headNodeId,
        kind: "next"
      });
      return { headNodeId: node.id, tailNodes: blockResult.tailNodes };
    }
  }
  return { headNodeId: node.id, tailNodes: [node] };
}
function processAction(step, jsonPointer, ctx) {
  const node = createActionNode(step, jsonPointer, ctx.config);
  node.ui = { ...node.ui, partition: ctx.partition };
  ctx.nodes.push(node);
  if (step.as) {
    ctx.aliasMap.set(step.as, node.id);
  }
  return { headNodeId: node.id, tailNodes: [node] };
}
function processIf(step, jsonPointer, ctx) {
  const ifNode = createIfNode(step, jsonPointer);
  ifNode.ui = { ...ifNode.ui, partition: PARTITION_CENTER };
  ctx.nodes.push(ifNode);
  if (step.as) {
    ctx.aliasMap.set(step.as, ifNode.id);
  }
  const block = step.block ?? [];
  const { mainSteps: thenSteps, container: elseContainer } = partitionBlock(block, "else");
  const thenBranch = createBranchNode(ifNode.id, "then", jsonPointer);
  thenBranch.ui = { ...thenBranch.ui, partition: PARTITION_UPPER };
  ctx.nodes.push(thenBranch);
  ctx.edges.push({
    id: makeEdgeId("true", ifNode.id, thenBranch.id),
    from: ifNode.id,
    to: thenBranch.id,
    kind: "true"
  });
  const savedPartition = ctx.partition;
  ctx.partition = PARTITION_UPPER;
  const thenResult = processStepSequence(thenSteps, `${jsonPointer}/block`, ctx);
  ctx.partition = savedPartition;
  if (thenResult.headNodeId) {
    ctx.edges.push({
      id: makeEdgeId("next", thenBranch.id, thenResult.headNodeId),
      from: thenBranch.id,
      to: thenResult.headNodeId,
      kind: "next"
    });
  }
  const branchTails = [];
  if (thenResult.tailNodes.length > 0) {
    branchTails.push(...thenResult.tailNodes);
  } else {
    branchTails.push(thenBranch);
  }
  let elseBranch = null;
  if (elseContainer) {
    const elsePointer = `${jsonPointer}/block/${block.indexOf(elseContainer)}`;
    elseBranch = createBranchNode(ifNode.id, "else", elsePointer, elseContainer.number);
    elseBranch.ui = { ...elseBranch.ui, partition: PARTITION_LOWER };
    ctx.nodes.push(elseBranch);
    ctx.edges.push({
      id: makeEdgeId("false", ifNode.id, elseBranch.id),
      from: ifNode.id,
      to: elseBranch.id,
      kind: "false"
    });
    ctx.partition = PARTITION_LOWER;
    const elseSteps = elseContainer.block ?? [];
    const elseResult = processStepSequence(elseSteps, `${elsePointer}/block`, ctx);
    ctx.partition = savedPartition;
    if (elseResult.headNodeId) {
      ctx.edges.push({
        id: makeEdgeId("next", elseBranch.id, elseResult.headNodeId),
        from: elseBranch.id,
        to: elseResult.headNodeId,
        kind: "next"
      });
    }
    if (elseResult.tailNodes.length > 0) {
      branchTails.push(...elseResult.tailNodes);
    } else {
      branchTails.push(elseBranch);
    }
  }
  const nonTerminalTails = branchTails.filter((t) => !t.ui?.isTerminal);
  if (!elseBranch) {
    ifNode.ui = { ...ifNode.ui, needsFalseExit: true };
    return { headNodeId: ifNode.id, tailNodes: [ifNode, ...nonTerminalTails] };
  }
  if (nonTerminalTails.length >= 1) {
    return { headNodeId: ifNode.id, tailNodes: nonTerminalTails };
  }
  return { headNodeId: ifNode.id, tailNodes: branchTails.filter((t) => t.ui?.isTerminal) };
}
function processTry(step, jsonPointer, ctx) {
  const tryNode = createTryNode(step, jsonPointer);
  tryNode.ui = { ...tryNode.ui, partition: PARTITION_CENTER };
  ctx.nodes.push(tryNode);
  if (step.as) {
    ctx.aliasMap.set(step.as, tryNode.id);
  }
  const block = step.block ?? [];
  const { mainSteps: trySteps, container: catchContainer } = partitionBlock(block, "catch");
  const savedPartition = ctx.partition;
  ctx.partition = PARTITION_UPPER;
  const tryResult = processStepSequence(trySteps, `${jsonPointer}/block`, ctx);
  ctx.partition = savedPartition;
  if (tryResult.headNodeId) {
    ctx.edges.push({
      id: makeEdgeId("next", tryNode.id, tryResult.headNodeId),
      from: tryNode.id,
      to: tryResult.headNodeId,
      kind: "next"
    });
  }
  const branchTails = [];
  if (tryResult.tailNodes.length > 0) {
    branchTails.push(...tryResult.tailNodes);
  } else {
    branchTails.push(tryNode);
  }
  if (catchContainer) {
    const catchPointer = `${jsonPointer}/block/${block.indexOf(catchContainer)}`;
    const catchNode = createCatchNode(catchContainer, catchPointer);
    catchNode.ui = { ...catchNode.ui, partition: PARTITION_CENTER };
    ctx.nodes.push(catchNode);
    if (catchContainer.as) {
      ctx.aliasMap.set(catchContainer.as, catchNode.id);
    }
    ctx.edges.push({
      id: makeEdgeId("error", tryNode.id, catchNode.id),
      from: tryNode.id,
      to: catchNode.id,
      kind: "error"
    });
    ctx.partition = PARTITION_LOWER;
    const catchSteps = catchContainer.block ?? [];
    const catchResult = processStepSequence(catchSteps, `${catchPointer}/block`, ctx);
    ctx.partition = savedPartition;
    if (catchResult.headNodeId) {
      ctx.edges.push({
        id: makeEdgeId("next", catchNode.id, catchResult.headNodeId),
        from: catchNode.id,
        to: catchResult.headNodeId,
        kind: "next"
      });
    }
    if (catchResult.tailNodes.length > 0) {
      branchTails.push(...catchResult.tailNodes);
    } else {
      branchTails.push(catchNode);
    }
  }
  const nonTerminalTails = branchTails.filter((t) => !t.ui?.isTerminal);
  if (nonTerminalTails.length >= 1) {
    return { headNodeId: tryNode.id, tailNodes: nonTerminalTails };
  }
  return { headNodeId: tryNode.id, tailNodes: branchTails.filter((t) => t.ui?.isTerminal) };
}
function processForeach(step, jsonPointer, ctx) {
  const foreachNode = createForeachNode(step, jsonPointer);
  ctx.nodes.push(foreachNode);
  if (step.as) {
    ctx.aliasMap.set(step.as, foreachNode.id);
  }
  const block = step.block ?? [];
  const bodyResult = processStepSequence(block, `${jsonPointer}/block`, ctx);
  if (bodyResult.headNodeId) {
    ctx.edges.push({
      id: makeEdgeId("loop", foreachNode.id, bodyResult.headNodeId),
      from: foreachNode.id,
      to: bodyResult.headNodeId,
      kind: "loop"
    });
    for (const tail of bodyResult.tailNodes) {
      if (!tail.ui?.isTerminal) {
        ctx.edges.push({
          id: makeEdgeId("loop", tail.id, foreachNode.id),
          from: tail.id,
          to: foreachNode.id,
          kind: "loop"
        });
      }
    }
  }
  return { headNodeId: foreachNode.id, tailNodes: [foreachNode] };
}
function extractRecipeMeta(recipe) {
  const connections = (recipe.config ?? []).filter((c) => c.keyword === "application").map((c) => ({
    provider: c.provider,
    displayName: getProviderDisplayName(c.provider) ?? c.provider,
    connectionName: c.account_id?.name
  }));
  return {
    name: recipe.name ?? "Untitled Recipe",
    version: recipe.version ?? 1,
    private: recipe.private ?? true,
    concurrency: recipe.concurrency ?? 1,
    connections
  };
}
function buildMinimalGraph(ctx, errorLabel) {
  const errorNode = {
    id: "::error",
    kind: "error",
    label: errorLabel,
    source: { jsonPointer: "/" },
    ui: {
      badge: ctx.diagnostics[ctx.diagnostics.length - 1]?.message ?? "Error"
    }
  };
  const endNode = createEndNode();
  return {
    nodes: [errorNode, endNode],
    edges: [
      {
        id: "error|::error|::end",
        from: "::error",
        to: "::end",
        kind: "next"
      }
    ],
    roots: ["::error"],
    meta: {
      name: "Invalid Recipe",
      version: 1,
      private: true,
      concurrency: 1,
      connections: []
    },
    diagnostics: ctx.diagnostics
  };
}
function buildIgm(recipeJson, _opts) {
  const ctx = {
    nodes: [],
    edges: [],
    diagnostics: [],
    aliasMap: /* @__PURE__ */ new Map(),
    config: void 0,
    partition: PARTITION_CENTER
    // Start on center axis
  };
  if (recipeJson === null || recipeJson === void 0) {
    ctx.diagnostics.push({
      level: "error",
      message: "Recipe JSON is null or undefined",
      source: { jsonPointer: "/" }
    });
    return buildMinimalGraph(ctx, "Empty recipe");
  }
  if (typeof recipeJson !== "object") {
    ctx.diagnostics.push({
      level: "error",
      message: `Recipe JSON must be an object, got ${typeof recipeJson}`,
      source: { jsonPointer: "/" }
    });
    return buildMinimalGraph(ctx, "Invalid recipe type");
  }
  const recipe = recipeJson;
  ctx.config = recipe.config;
  if (!recipe.code) {
    ctx.diagnostics.push({
      level: "error",
      message: "Recipe is missing required 'code' field",
      source: { jsonPointer: "/" }
    });
    return buildMinimalGraph(ctx, "Missing code block");
  }
  let rootId = null;
  try {
    const result = processStep(recipe.code, "/code", ctx);
    rootId = result.headNodeId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.diagnostics.push({
      level: "error",
      message: `Failed to process recipe: ${message}`,
      source: { jsonPointer: "/code" }
    });
    return buildMinimalGraph(ctx, "Processing failed");
  }
  const endNode = createEndNode();
  ctx.nodes.push(endNode);
  for (const node of ctx.nodes) {
    if (node.ui?.isTerminal) {
      ctx.edges.push({
        id: makeEdgeId("terminal", node.id, "::end"),
        from: node.id,
        to: "::end",
        kind: "terminal"
      });
    }
  }
  const nodesWithOutgoing = new Set(ctx.edges.map((e) => e.from));
  for (const node of ctx.nodes) {
    if (node.id === "::end")
      continue;
    if (node.ui?.isTerminal)
      continue;
    if (!nodesWithOutgoing.has(node.id)) {
      ctx.edges.push({
        id: makeEdgeId("next", node.id, "::end"),
        from: node.id,
        to: "::end",
        kind: "next"
      });
    }
  }
  const meta = extractRecipeMeta(recipe);
  return {
    nodes: ctx.nodes,
    edges: ctx.edges,
    roots: rootId ? [rootId] : [],
    meta,
    diagnostics: ctx.diagnostics.length > 0 ? ctx.diagnostics : void 0
  };
}

// extension/jsonPointer.ts
var vscode = __toESM(require("vscode"));

// node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value2 = value2 * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value2 = value2 * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value2 = value2 * 16 + ch - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value2 = -1;
    }
    return value2;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 || text.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 || text.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34:
            result += '"';
            break;
          case 92:
            result += "\\";
            break;
          case 47:
            result += "/";
            break;
          case 98:
            result += "\b";
            break;
          case 102:
            result += "\f";
            break;
          case 110:
            result += "\n";
            break;
          case 114:
            result += "\r";
            break;
          case 116:
            result += "	";
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17;
    }
    let code = text.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text.charCodeAt(pos) === 10) {
        pos++;
        value += "\n";
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = 14;
    }
    switch (code) {
      case 123:
        pos++;
        return token = 1;
      case 125:
        pos++;
        return token = 2;
      case 91:
        pos++;
        return token = 3;
      case 93:
        pos++;
        return token = 4;
      case 58:
        pos++;
        return token = 6;
      case 44:
        pos++;
        return token = 5;
      case 34:
        pos++;
        value = scanString();
        return token = 10;
      case 47:
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12;
        }
        if (text.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 && text.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = 16;
        }
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return token = 11;
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8;
            case "false":
              return token = 9;
            case "null":
              return token = 7;
          }
          return token = 16;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError
  };
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
var CharacterCodes;
(function(CharacterCodes2) {
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

// node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_, index) => {
  return " ".repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  " ": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + " ".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + " ".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + " ".repeat(index);
    })
  },
  "	": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + "	".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + "	".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + "	".repeat(index);
    })
  }
};

// node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === "property") {
        if (sep === ":") {
          currentParent.colonOffset = offset;
        } else if (sep === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (let segment of path) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks++;
      } else {
        let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
        if (cbReturn === false) {
          suppressedCallbacks = 1;
        }
      }
    } : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks--;
      }
      if (suppressedCallbacks === 0) {
        visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
      }
    } : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError(
              11
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(
              10
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(
            1
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError(
            2
            /* ParseErrorCode.InvalidNumberFormat */
          );
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError(3, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
    } else {
      handleError(5, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(7, [
        2
        /* SyntaxKind.CloseBraceToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [
          4,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError(8, [
        4
        /* SyntaxKind.CloseBracketToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray();
      case 1:
        return parseObject();
      case 10:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}

// node_modules/jsonc-parser/lib/esm/main.js
var ScanError;
(function(ScanError2) {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function(SyntaxKind2) {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
var parseTree2 = parseTree;
var findNodeAtLocation2 = findNodeAtLocation;
var ParseErrorCode;
(function(ParseErrorCode2) {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));

// extension/jsonPointer.ts
function jsonPointerToPosition(documentText, jsonPointer) {
  if (!jsonPointer || jsonPointer === "/") {
    return new vscode.Position(0, 0);
  }
  const root = parseTree2(documentText);
  if (!root) {
    return new vscode.Position(0, 0);
  }
  const segments = jsonPointerToPath(jsonPointer);
  if (segments.length === 0) {
    return new vscode.Position(0, 0);
  }
  const node = findNodeAtLocation2(root, segments);
  if (!node) {
    const parentSegments = segments.slice(0, -1);
    const parentNode = parentSegments.length > 0 ? findNodeAtLocation2(root, parentSegments) : root;
    if (parentNode) {
      return offsetToPosition(documentText, parentNode.offset);
    }
    return new vscode.Position(0, 0);
  }
  return offsetToPosition(documentText, node.offset);
}
function positionToJsonPointer(documentText, position) {
  const root = parseTree2(documentText);
  if (!root) {
    return null;
  }
  const offset = positionToOffset(documentText, position);
  if (offset === null) {
    return null;
  }
  const path = findPathAtOffset(root, offset);
  if (!path || path.length === 0) {
    return "/";
  }
  return pathToJsonPointer(path);
}
function findPathAtOffset(node, offset, path = []) {
  if (offset < node.offset || offset > node.offset + node.length) {
    return null;
  }
  if (node.children) {
    if (node.type === "object") {
      for (const prop of node.children) {
        if (prop.children && prop.children.length >= 2) {
          const keyNode = prop.children[0];
          const valueNode = prop.children[1];
          if (offset >= valueNode.offset && offset <= valueNode.offset + valueNode.length) {
            const key = keyNode.value;
            const result = findPathAtOffset(valueNode, offset, [...path, key]);
            if (result) {
              return result;
            }
            return [...path, key];
          }
        }
      }
    } else if (node.type === "array") {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (offset >= child.offset && offset <= child.offset + child.length) {
          const result = findPathAtOffset(child, offset, [...path, i]);
          if (result) {
            return result;
          }
          return [...path, i];
        }
      }
    }
  }
  return path.length > 0 ? path : null;
}
function jsonPointerToPath(pointer) {
  if (!pointer || pointer === "/") {
    return [];
  }
  return pointer.split("/").slice(1).map((segment) => {
    const unescaped = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    const num = parseInt(unescaped, 10);
    return !isNaN(num) && String(num) === unescaped ? num : unescaped;
  });
}
function pathToJsonPointer(path) {
  if (path.length === 0) {
    return "/";
  }
  return "/" + path.map((segment) => {
    const str = String(segment);
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
  }).join("/");
}
function offsetToPosition(documentText, offset) {
  if (offset < 0 || offset > documentText.length) {
    return null;
  }
  let line = 0;
  let col = 0;
  for (let i = 0; i < offset; i++) {
    if (documentText[i] === "\n") {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return new vscode.Position(line, col);
}
function positionToOffset(documentText, position) {
  const lines = documentText.split("\n");
  if (position.line >= lines.length) {
    return null;
  }
  let offset = 0;
  for (let i = 0; i < position.line; i++) {
    offset += lines[i].length + 1;
  }
  offset += Math.min(position.character, lines[position.line].length);
  return offset;
}

// extension/RecipeVisualizerPanel.ts
var RecipeVisualizerPanel = class _RecipeVisualizerPanel {
  static currentPanel;
  static viewType = "recipeVisualizer";
  _panel;
  _extensionUri;
  _document;
  _disposables = [];
  // Track if webview panel is currently active/focused
  _isActive = false;
  static createOrShow(extensionUri, document) {
    const column = vscode2.ViewColumn.Beside;
    if (_RecipeVisualizerPanel.currentPanel) {
      _RecipeVisualizerPanel.currentPanel._document = document;
      _RecipeVisualizerPanel.currentPanel._updateGraph();
      _RecipeVisualizerPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode2.window.createWebviewPanel(
      _RecipeVisualizerPanel.viewType,
      "Recipe Visualizer",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode2.Uri.joinPath(extensionUri, "dist", "webview")]
      }
    );
    _RecipeVisualizerPanel.currentPanel = new _RecipeVisualizerPanel(
      panel,
      extensionUri,
      document
    );
  }
  static updateIfActive(document) {
    if (_RecipeVisualizerPanel.currentPanel && _RecipeVisualizerPanel.currentPanel._document.uri.toString() === document.uri.toString()) {
      _RecipeVisualizerPanel.currentPanel._document = document;
      _RecipeVisualizerPanel.currentPanel._updateGraph();
    }
  }
  static switchToDocument(document) {
    if (_RecipeVisualizerPanel.currentPanel) {
      _RecipeVisualizerPanel.currentPanel._document = document;
      _RecipeVisualizerPanel.currentPanel._updateGraph();
    }
  }
  static closeIfDocumentClosed(document) {
    const panel = _RecipeVisualizerPanel.currentPanel;
    if (!panel)
      return;
    if (panel._document.uri.toString() === document.uri.toString()) {
      panel.dispose();
    }
  }
  static syncSelection(editor) {
    const panel = _RecipeVisualizerPanel.currentPanel;
    if (!panel)
      return;
    if (panel._document.uri.toString() !== editor.document.uri.toString()) {
      return;
    }
    if (panel._isActive) {
      return;
    }
    const position = editor.selection.active;
    const documentText = editor.document.getText();
    const jsonPointer = positionToJsonPointer(documentText, position);
    const message = {
      type: "updateSelection",
      jsonPointer
    };
    panel._panel.webview.postMessage(message);
  }
  constructor(panel, extensionUri, document) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._document = document;
    this._panel.webview.html = this._getHtmlForWebview();
    this._isActive = this._panel.active;
    this._panel.onDidChangeViewState(
      (e) => {
        this._isActive = e.webviewPanel.active;
      },
      null,
      this._disposables
    );
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }
  dispose() {
    _RecipeVisualizerPanel.currentPanel = void 0;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
  _handleMessage(message) {
    switch (message.type) {
      case "webviewReady":
        this._updateGraph();
        break;
      case "nodeSelected":
        break;
      case "navigateToSource":
        this._navigateToSource(message.jsonPointer, message.uuid);
        break;
      case "openCalledRecipe":
        this._openCalledRecipe(message.zipName, message.recipeName);
        break;
    }
  }
  _navigateToSource(jsonPointer, uuid) {
    const documentText = this._document.getText();
    let position = null;
    position = jsonPointerToPosition(documentText, jsonPointer);
    if (!position && uuid) {
      position = this._findUuidPosition(documentText, uuid);
    }
    if (position) {
      vscode2.window.showTextDocument(this._document, {
        selection: new vscode2.Selection(position, position),
        viewColumn: vscode2.ViewColumn.One,
        preserveFocus: false
      }).then((editor) => {
        editor.revealRange(
          new vscode2.Range(position, position),
          vscode2.TextEditorRevealType.AtTop
        );
      });
    }
  }
  _findUuidPosition(documentText, uuid) {
    const uuidPattern = `"uuid"\\s*:\\s*"${uuid}"`;
    const regex = new RegExp(uuidPattern);
    const match = regex.exec(documentText);
    if (match) {
      const offset = match.index;
      let line = 0;
      let col = 0;
      for (let i = 0; i < offset; i++) {
        if (documentText[i] === "\n") {
          line++;
          col = 0;
        } else {
          col++;
        }
      }
      return new vscode2.Position(line, col);
    }
    return null;
  }
  async _openCalledRecipe(zipName, recipeName) {
    const workspaceFolder = vscode2.workspace.getWorkspaceFolder(this._document.uri);
    if (!workspaceFolder) {
      vscode2.window.showWarningMessage(`Cannot find workspace for recipe lookup`);
      return;
    }
    const pattern = new vscode2.RelativePattern(workspaceFolder, `**/${zipName}`);
    const files = await vscode2.workspace.findFiles(pattern, "**/node_modules/**", 1);
    if (files.length > 0) {
      const doc = await vscode2.workspace.openTextDocument(files[0]);
      await vscode2.window.showTextDocument(doc, { viewColumn: vscode2.ViewColumn.One });
      _RecipeVisualizerPanel.createOrShow(this._extensionUri, doc);
      return;
    }
    const fileName = zipName.split("/").pop();
    if (fileName) {
      const fallbackPattern = new vscode2.RelativePattern(workspaceFolder, `**/${fileName}`);
      const fallbackFiles = await vscode2.workspace.findFiles(fallbackPattern, "**/node_modules/**", 1);
      if (fallbackFiles.length > 0) {
        const doc = await vscode2.workspace.openTextDocument(fallbackFiles[0]);
        await vscode2.window.showTextDocument(doc, { viewColumn: vscode2.ViewColumn.One });
        _RecipeVisualizerPanel.createOrShow(this._extensionUri, doc);
        return;
      }
    }
    vscode2.window.showWarningMessage(
      `Recipe "${recipeName || zipName}" not found in workspace`
    );
  }
  _updateGraph() {
    try {
      const content = this._document.getText();
      const recipeJson = JSON.parse(content);
      const graph = buildIgm(recipeJson);
      const message = {
        type: "renderGraph",
        graph,
        documentUri: this._document.uri.toString()
      };
      this._panel.webview.postMessage(message);
    } catch (e) {
      console.error("Failed to build IGM:", e);
      vscode2.window.showErrorMessage(
        `Failed to parse recipe: ${e.message}`
      );
    }
  }
  _getHtmlForWebview() {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this._extensionUri, "dist", "webview", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this._extensionUri, "dist", "webview", "assets", "index.css")
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>Recipe Visualizer</title>
  <style>
    html, body, #root {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// extension/extension.ts
function activate(context) {
  console.log("Recipe Visualizer extension activated");
  const openVisualizerCommand = vscode3.commands.registerCommand(
    "recipeVisualizer.open",
    () => {
      const editor = vscode3.window.activeTextEditor;
      if (editor && isRecipeFile(editor.document)) {
        RecipeVisualizerPanel.createOrShow(context.extensionUri, editor.document);
      } else {
        vscode3.window.showWarningMessage(
          "Please open a recipe JSON file to visualize"
        );
      }
    }
  );
  const openFromContextCommand = vscode3.commands.registerCommand(
    "recipeVisualizer.openFromContext",
    (uri) => {
      vscode3.workspace.openTextDocument(uri).then(async (document) => {
        if (isRecipeFile(document)) {
          await vscode3.window.showTextDocument(document, { viewColumn: vscode3.ViewColumn.One });
          RecipeVisualizerPanel.createOrShow(context.extensionUri, document);
        } else {
          vscode3.window.showWarningMessage("This does not appear to be a recipe JSON file");
        }
      });
    }
  );
  const documentChangeListener = vscode3.workspace.onDidChangeTextDocument((e) => {
    if (isRecipeFile(e.document)) {
      RecipeVisualizerPanel.updateIfActive(e.document);
    }
  });
  const documentSaveListener = vscode3.workspace.onDidSaveTextDocument((document) => {
    if (isRecipeFile(document)) {
      RecipeVisualizerPanel.updateIfActive(document);
    }
  });
  const selectionChangeListener = vscode3.window.onDidChangeTextEditorSelection((e) => {
    if (isRecipeFile(e.textEditor.document)) {
      RecipeVisualizerPanel.syncSelection(e.textEditor);
    }
  });
  const activeEditorChangeListener = vscode3.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor && isRecipeFile(editor.document)) {
      if (RecipeVisualizerPanel.currentPanel && editor.viewColumn !== vscode3.ViewColumn.One) {
        await vscode3.commands.executeCommand("workbench.action.moveEditorToFirstGroup");
      }
      RecipeVisualizerPanel.switchToDocument(editor.document);
    }
  });
  const documentCloseListener = vscode3.workspace.onDidCloseTextDocument((document) => {
    RecipeVisualizerPanel.closeIfDocumentClosed(document);
  });
  context.subscriptions.push(
    openVisualizerCommand,
    openFromContextCommand,
    documentChangeListener,
    documentSaveListener,
    selectionChangeListener,
    activeEditorChangeListener,
    documentCloseListener
  );
}
function deactivate() {
  console.log("Recipe Visualizer extension deactivated");
}
function isRecipeFile(document) {
  if (document.languageId !== "json")
    return false;
  if (document.fileName.endsWith(".recipe.json"))
    return true;
  try {
    const content = document.getText();
    const json = JSON.parse(content);
    return typeof json === "object" && json !== null && "code" in json && typeof json.code === "object" && "keyword" in json.code;
  } catch {
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
