/**
 * Transformer tests
 * Run with: npx tsx core/transformer.test.ts
 */

import { buildIgm } from "./transformer";
import { readFileSync } from "fs";
import { join } from "path";

// Helper to load fixture
function loadFixture(name: string): unknown {
  const path = join(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Test helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// Tests
// ============================================================================

console.log("\n=== Transformer Tests ===\n");

test("upsert_contact: builds correct node count", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  // Expected nodes:
  // trigger, try, upsert_contact, return_result, catch, log_error, ::end
  // (No join node needed when only one non-terminal branch)
  // That's 7 nodes
  assert(graph.nodes.length === 7, `Expected 7 nodes, got ${graph.nodes.length}`);
});

test("upsert_contact: has exactly one ::end node", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const endNodes = graph.nodes.filter((n) => n.id === "::end");
  assert(endNodes.length === 1, `Expected 1 ::end node, got ${endNodes.length}`);
});

test("upsert_contact: trigger is root", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  assert(graph.roots.length === 1, `Expected 1 root, got ${graph.roots.length}`);
  const rootNode = graph.nodes.find((n) => n.id === graph.roots[0]);
  assert(rootNode?.kind === "trigger", `Expected root to be trigger, got ${rootNode?.kind}`);
});

test("upsert_contact: return_result is terminal", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const returnNode = graph.nodes.find((n) => n.label === "return_result");
  assert(returnNode !== undefined, "Could not find return_result node");
  assert(returnNode.ui?.isTerminal === true, "return_result should be terminal");
});

test("upsert_contact: terminal connects to ::end", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const terminalEdges = graph.edges.filter((e) => e.kind === "terminal");
  assert(terminalEdges.length === 1, `Expected 1 terminal edge, got ${terminalEdges.length}`);
  assert(terminalEdges[0].to === "::end", "Terminal edge should connect to ::end");
});

test("upsert_contact: try has error edge to catch", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const errorEdges = graph.edges.filter((e) => e.kind === "error");
  assert(errorEdges.length === 1, `Expected 1 error edge, got ${errorEdges.length}`);

  const catchNode = graph.nodes.find((n) => n.kind === "catch");
  assert(catchNode !== undefined, "Could not find catch node");
  assert(errorEdges[0].to === catchNode.id, "Error edge should connect to catch node");
});

test("upsert_contact: extracts recipe metadata", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  assert(graph.meta !== undefined, "Meta should be present");
  assert(graph.meta.name === "Upsert contact", `Expected name 'Upsert contact', got '${graph.meta.name}'`);
  assert(graph.meta.connections.length === 3, `Expected 3 connections, got ${graph.meta.connections.length}`);
});

test("ha_api_control_light: handles nested if/else", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  // Count if nodes
  const ifNodes = graph.nodes.filter((n) => n.kind === "if");
  assert(ifNodes.length === 3, `Expected 3 if nodes, got ${ifNodes.length}`);

  // Count branch nodes (then/else)
  const branchNodes = graph.nodes.filter((n) => n.kind === "branch");
  assert(branchNodes.length >= 6, `Expected at least 6 branch nodes, got ${branchNodes.length}`);
});

test("ha_api_control_light: has multiple terminal nodes", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  const terminalNodes = graph.nodes.filter((n) => n.ui?.isTerminal);
  // return-success-001, return-404-001, return-401-001, return-403-001, return-500-001
  assert(terminalNodes.length === 5, `Expected 5 terminal nodes, got ${terminalNodes.length}`);
});

test("ha_api_control_light: all terminals connect to ::end", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  const terminalNodes = graph.nodes.filter((n) => n.ui?.isTerminal);
  const terminalEdges = graph.edges.filter((e) => e.kind === "terminal");

  assert(
    terminalEdges.length === terminalNodes.length,
    `Expected ${terminalNodes.length} terminal edges, got ${terminalEdges.length}`
  );

  for (const edge of terminalEdges) {
    assert(edge.to === "::end", `Terminal edge ${edge.id} should connect to ::end`);
  }
});

test("ha_api_control_light: extracts HTTP status codes", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  const nodesWithStatus = graph.nodes.filter((n) => n.ui?.httpStatus);
  const statuses = nodesWithStatus.map((n) => n.ui?.httpStatus).sort();

  assert(statuses.includes("200"), "Should have 200 status");
  assert(statuses.includes("401"), "Should have 401 status");
  assert(statuses.includes("403"), "Should have 403 status");
  assert(statuses.includes("404"), "Should have 404 status");
  assert(statuses.includes("500"), "Should have 500 status");
});

test("ha_api_control_light: trigger is api_endpoint type", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  const triggerNode = graph.nodes.find((n) => n.kind === "trigger");
  assert(triggerNode !== undefined, "Could not find trigger node");
  assert(
    triggerNode.ui?.triggerType === "api_endpoint",
    `Expected api_endpoint trigger type, got ${triggerNode.ui?.triggerType}`
  );
});

test("stable IDs: same input produces same node IDs", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph1 = buildIgm(recipe);
  const graph2 = buildIgm(recipe);

  const ids1 = graph1.nodes.map((n) => n.id).sort();
  const ids2 = graph2.nodes.map((n) => n.id).sort();

  assert(
    JSON.stringify(ids1) === JSON.stringify(ids2),
    "Node IDs should be deterministic"
  );
});

test("all non-terminal non-end nodes have outgoing edges", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  const nodesWithOutgoing = new Set(graph.edges.map((e) => e.from));

  for (const node of graph.nodes) {
    if (node.id === "::end") continue;
    if (node.ui?.isTerminal) continue;

    assert(
      nodesWithOutgoing.has(node.id),
      `Node ${node.id} (${node.kind}) has no outgoing edges`
    );
  }
});

// ============================================================================
// Foreach (loop) tests
// ============================================================================

test("search_rooms_foreach: has foreach node", () => {
  const recipe = loadFixture("search_rooms_foreach.recipe.json");
  const graph = buildIgm(recipe);

  const foreachNodes = graph.nodes.filter((n) => n.kind === "foreach");
  assert(foreachNodes.length === 1, `Expected 1 foreach node, got ${foreachNodes.length}`);
});

test("search_rooms_foreach: foreach has loop edge", () => {
  const recipe = loadFixture("search_rooms_foreach.recipe.json");
  const graph = buildIgm(recipe);

  const loopEdges = graph.edges.filter((e) => e.kind === "loop");
  assert(loopEdges.length >= 1, `Expected at least 1 loop edge, got ${loopEdges.length}`);

  // Loop edge should go back to foreach node
  const foreachNode = graph.nodes.find((n) => n.kind === "foreach");
  assert(foreachNode !== undefined, "Could not find foreach node");
  assert(
    loopEdges.some((e) => e.to === foreachNode.id),
    "Loop edge should connect back to foreach node"
  );
});

test("search_rooms_foreach: foreach is its own exit point (no separate join)", () => {
  const recipe = loadFixture("search_rooms_foreach.recipe.json");
  const graph = buildIgm(recipe);

  const foreachNode = graph.nodes.find((n) => n.kind === "foreach");
  assert(foreachNode !== undefined, "Could not find foreach node");

  // Foreach should NOT have its own join node - it is its own exit point
  const foreachJoinNode = graph.nodes.find((n) => n.id === `${foreachNode.id}::join`);
  assert(foreachJoinNode === undefined, "Foreach should not have a separate join node");

  // Foreach should have outgoing exit edge (to next step after loop)
  const exitEdges = graph.edges.filter((e) => e.from === foreachNode.id && e.kind === "exit");
  assert(exitEdges.length >= 1, "Foreach should have at least one outgoing exit edge");
});

test("search_rooms_foreach: foreach stores loop metadata", () => {
  const recipe = loadFixture("search_rooms_foreach.recipe.json");
  const graph = buildIgm(recipe);

  const foreachNode = graph.nodes.find((n) => n.kind === "foreach");
  assert(foreachNode !== undefined, "Could not find foreach node");
  assert(foreachNode.ui?.repeatMode === "simple", `Expected repeat_mode 'simple', got '${foreachNode.ui?.repeatMode}'`);
  assert(foreachNode.ui?.loopSource !== undefined, "Expected loopSource to be set");
});

// ============================================================================
// Error recovery tests
// ============================================================================

test("error recovery: handles null input", () => {
  const graph = buildIgm(null);

  assert(graph.nodes.length >= 1, "Should have at least error node");
  const errorNode = graph.nodes.find((n) => n.kind === "error");
  assert(errorNode !== undefined, "Should have error node");
  assert(graph.diagnostics !== undefined, "Should have diagnostics");
  assert(graph.diagnostics.length > 0, "Should have at least one diagnostic");
  assert(graph.diagnostics[0].level === "error", "Should be error level");
});

test("error recovery: handles undefined input", () => {
  const graph = buildIgm(undefined);

  assert(graph.nodes.length >= 1, "Should have at least error node");
  const errorNode = graph.nodes.find((n) => n.kind === "error");
  assert(errorNode !== undefined, "Should have error node");
});

test("error recovery: handles non-object input", () => {
  const graph = buildIgm("not an object");

  assert(graph.nodes.length >= 1, "Should have at least error node");
  const errorNode = graph.nodes.find((n) => n.kind === "error");
  assert(errorNode !== undefined, "Should have error node");
  assert(graph.diagnostics?.[0]?.message.includes("must be an object"), "Should report type error");
});

test("error recovery: handles missing code field", () => {
  const graph = buildIgm({ name: "Test Recipe" });

  assert(graph.nodes.length >= 1, "Should have at least error node");
  const errorNode = graph.nodes.find((n) => n.kind === "error");
  assert(errorNode !== undefined, "Should have error node");
  assert(graph.diagnostics?.[0]?.message.includes("missing"), "Should report missing code");
});

test("error recovery: handles empty object", () => {
  const graph = buildIgm({});

  assert(graph.nodes.length >= 1, "Should have at least error node");
  assert(graph.diagnostics !== undefined, "Should have diagnostics");
});

// ============================================================================
// Recipe call tests
// ============================================================================

test("recipe call: detects call_recipe actions", () => {
  const recipe = {
    name: "Test Recipe Call",
    code: {
      keyword: "trigger",
      provider: "workato_recipe_function",
      name: "execute",
      uuid: "trigger-uuid",
      block: [
        {
          keyword: "action",
          provider: "workato_recipe_function",
          name: "call_recipe",
          as: "search_contact",
          uuid: "call-recipe-uuid",
          number: 1,
          input: {
            flow_id: {
              zip_name: "atomic-salesforce-recipes/search_contact_by_email.recipe.json",
              name: "Search contact by email",
              folder: "atomic-salesforce-recipes",
            },
          },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const callNode = graph.nodes.find((n) => n.step?.name === "call_recipe");
  assert(callNode !== undefined, "Should have call_recipe node");
  assert(callNode.ui?.isRecipeCall === true, "Should be marked as recipe call");
  assert(
    callNode.ui?.recipeCallRef?.zipName === "atomic-salesforce-recipes/search_contact_by_email.recipe.json",
    `Expected zipName to match, got ${callNode.ui?.recipeCallRef?.zipName}`
  );
  assert(
    callNode.ui?.recipeCallRef?.name === "Search contact by email",
    `Expected name to match, got ${callNode.ui?.recipeCallRef?.name}`
  );
  assert(
    callNode.ui?.recipeCallRef?.folder === "atomic-salesforce-recipes",
    `Expected folder to match, got ${callNode.ui?.recipeCallRef?.folder}`
  );
});

test("recipe call: does not detect old 'call' name (regression)", () => {
  const recipe = {
    name: "Test Old Call Name",
    code: {
      keyword: "trigger",
      provider: "test",
      name: "test",
      uuid: "trigger-uuid",
      block: [
        {
          keyword: "action",
          provider: "workato_recipe_function",
          name: "call", // Old name - should NOT be detected
          uuid: "call-uuid",
          number: 1,
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const callNode = graph.nodes.find((n) => n.step?.name === "call");
  assert(callNode !== undefined, "Should have call node");
  assert(callNode.ui?.isRecipeCall !== true, "Should NOT be marked as recipe call with old name");
});

// ============================================================================
// Error recovery tests
// ============================================================================

test("error recovery: unknown keyword creates error node and continues", () => {
  const recipe = {
    name: "Test",
    code: {
      keyword: "trigger",
      provider: "test",
      name: "test",
      uuid: "trigger-uuid",
      block: [
        {
          keyword: "unknown_keyword_xyz",
          uuid: "unknown-uuid",
          number: 1,
        },
        {
          keyword: "action",
          provider: "logger",
          name: "log",
          uuid: "action-uuid",
          number: 2,
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  // Should have trigger, error node for unknown, action, and end
  assert(graph.nodes.length >= 3, `Expected at least 3 nodes, got ${graph.nodes.length}`);
  const errorNode = graph.nodes.find((n) => n.kind === "error");
  assert(errorNode !== undefined, "Should have error node for unknown keyword");
  const actionNode = graph.nodes.find((n) => n.kind === "action");
  assert(actionNode !== undefined, "Should still process subsequent action");
});

// ============================================================================
// Schema values display tests
// ============================================================================

test("schema values: input schema fields have values from step.input", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  // Find the Salesforce upsert action
  const upsertNode = graph.nodes.find((n) => n.label === "upsert_contact");
  assert(upsertNode !== undefined, "Could not find upsert_contact node");
  assert(upsertNode.inputSchema !== undefined, "Input schema should be present");

  // Find the Email field in the input schema
  const emailField = upsertNode.inputSchema.find((f) => f.name === "Email");
  assert(emailField !== undefined, "Could not find Email field in schema");
  assert(emailField.value !== undefined, "Email field should have a value");
  assert(
    emailField.value.includes("trigger.parameters.email"),
    `Expected datapill path in value, got: ${emailField.value}`
  );
});

test("schema values: datapills are simplified to readable format", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const upsertNode = graph.nodes.find((n) => n.label === "upsert_contact");
  assert(upsertNode !== undefined, "Could not find upsert_contact node");
  assert(upsertNode.inputSchema !== undefined, "Input schema should be present");

  const lastNameField = upsertNode.inputSchema.find((f) => f.name === "LastName");
  assert(lastNameField !== undefined, "Could not find LastName field");
  assert(lastNameField.value !== undefined, "LastName should have a value");
  // Should be simplified from the raw datapill format
  assert(
    !lastNameField.value.includes("_dp("),
    "Value should be simplified, not raw datapill"
  );
});

test("schema values: output schema fields have no values", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  // Trigger node has output schema (the parameters it provides)
  const triggerNode = graph.nodes.find((n) => n.kind === "trigger");
  assert(triggerNode !== undefined, "Could not find trigger node");
  assert(triggerNode.outputSchema !== undefined, "Output schema should be present");

  // Output schema fields should NOT have values (they're runtime-produced)
  for (const field of triggerNode.outputSchema) {
    assert(
      field.value === undefined,
      `Output schema field ${field.name} should not have a value`
    );
  }
});

test("schema values: fields without input values have undefined value", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const upsertNode = graph.nodes.find((n) => n.label === "upsert_contact");
  assert(upsertNode !== undefined, "Could not find upsert_contact node");
  assert(upsertNode.inputSchema !== undefined, "Input schema should be present");

  // Find a field that exists in schema but has no value in step.input
  // (there are many optional fields in Salesforce that aren't set)
  const birthdateField = upsertNode.inputSchema.find((f) => f.name === "Birthdate");
  assert(birthdateField !== undefined, "Could not find Birthdate field");
  assert(
    birthdateField.value === undefined,
    "Birthdate should have undefined value (not set in input)"
  );
});

test("schema values: preserves optional flag for UI warning detection", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const upsertNode = graph.nodes.find((n) => n.label === "upsert_contact");
  assert(upsertNode !== undefined, "Could not find upsert_contact node");
  assert(upsertNode.inputSchema !== undefined, "Input schema should be present");

  // LastName is required (optional: undefined means required in Salesforce)
  // Find a field that's explicitly optional
  const birthdateField = upsertNode.inputSchema.find((f) => f.name === "Birthdate");
  assert(birthdateField !== undefined, "Could not find Birthdate field");
  assert(birthdateField.optional === true, "Birthdate should be optional");

  // Find a required field
  const lastNameField = upsertNode.inputSchema.find((f) => f.name === "LastName");
  assert(lastNameField !== undefined, "Could not find LastName field");
  // In this fixture, LastName doesn't have explicit optional flag (means required)
  assert(
    lastNameField.optional !== true,
    "LastName should not be optional"
  );
});

test("schema values: nested object values are extracted", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  // Find the return_result action which has nested result object
  const returnNode = graph.nodes.find((n) => n.label === "return_result");
  assert(returnNode !== undefined, "Could not find return_result node");
  assert(returnNode.inputSchema !== undefined, "Input schema should be present");

  // Find the result field which has nested properties
  const resultField = returnNode.inputSchema.find((f) => f.name === "result");
  assert(resultField !== undefined, "Could not find result field");
  assert(resultField.properties !== undefined, "Result should have nested properties");

  // Check nested id field has value
  const idField = resultField.properties.find((f) => f.name === "id");
  assert(idField !== undefined, "Could not find nested id field");
  assert(idField.value !== undefined, "Nested id field should have a value");
  assert(
    idField.value.includes("upsert_contact"),
    `Expected datapill referencing upsert_contact, got: ${idField.value}`
  );
});

// ============================================================================
// Datapill simplification tests
// ============================================================================

test("datapill: HA recipe mixed-text message shows (formula), not false reference", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  // log-request-001 has message with literal text + multiple datapills:
  // "Guest =_dp('{...X-Guest-Name...}') controlling light =_dp('{...entity_id...}') ..."
  // This is surfaced via step.inputs (not inputSchema, since message isn't in extended_input_schema)
  const logNode = graph.nodes.find((n) => n.label === "log-request-001");
  assert(logNode !== undefined, "Could not find log-request-001 node");
  assert(logNode.step?.inputs !== undefined, "step.inputs should be present");
  assert(
    logNode.step.inputs.message === "(formula)",
    `Expected '(formula)' for mixed-text datapill, got: '${logNode.step.inputs.message}'`
  );
});

test("datapill: HA recipe pure formula =_dp() simplifies to step.path", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  // call-service-001 has service input as pure =_dp('{...}') — surfaced via step.inputs
  const callServiceNode = graph.nodes.find((n) => n.label === "call-service-001");
  assert(callServiceNode !== undefined, "Could not find call-service-001 node");
  assert(callServiceNode.step?.inputs !== undefined, "step.inputs should be present");

  const serviceValue = callServiceNode.step.inputs.service;
  assert(serviceValue !== undefined, "service input should have a value");
  assert(
    serviceValue.includes("05a31061") && serviceValue.includes("service"),
    `Expected clean datapill reference, got: '${serviceValue}'`
  );
  assert(
    !serviceValue.includes("_dp("),
    "Value should be simplified, not raw datapill"
  );
});

test("datapill: pure #{_dp()} interpolation still simplifies correctly", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const upsertNode = graph.nodes.find((n) => n.label === "upsert_contact");
  assert(upsertNode !== undefined, "Could not find upsert_contact node");
  assert(upsertNode.inputSchema !== undefined, "Input schema should be present");

  // Email uses pure #{_dp(...)} pattern
  const emailField = upsertNode.inputSchema.find((f) => f.name === "Email");
  assert(emailField !== undefined, "Could not find Email field");
  assert(emailField.value !== undefined, "Email should have a value");
  assert(
    emailField.value.includes("trigger.parameters.email"),
    `Expected simplified datapill path, got: '${emailField.value}'`
  );
});

test("datapill: formula with .present? ternary shows (formula)", () => {
  const recipe = loadFixture("upsert_contact.recipe.json");
  const graph = buildIgm(recipe);

  const upsertNode = graph.nodes.find((n) => n.label === "upsert_contact");
  assert(upsertNode !== undefined, "Could not find upsert_contact node");
  assert(upsertNode.inputSchema !== undefined, "Input schema should be present");

  // FirstName uses =_dp('{...}').present? ? _dp('{...}') : skip — multiple _dp() calls
  const firstNameField = upsertNode.inputSchema.find((f) => f.name === "FirstName");
  assert(firstNameField !== undefined, "Could not find FirstName field");
  assert(firstNameField.value !== undefined, "FirstName should have a value");
  assert(
    firstNameField.value === "(formula)",
    `Expected '(formula)' for ternary formula, got: '${firstNameField.value}'`
  );
});

test("datapill: HA recipe error log message shows (formula)", () => {
  const recipe = loadFixture("ha_api_control_light.recipe.json");
  const graph = buildIgm(recipe);

  // log-error-001 also has mixed literal text + datapill in message
  const logErrorNode = graph.nodes.find((n) => n.label === "log-error-001");
  assert(logErrorNode !== undefined, "Could not find log-error-001 node");
  assert(logErrorNode.step?.inputs !== undefined, "step.inputs should be present");
  assert(
    logErrorNode.step.inputs.message === "(formula)",
    `Expected '(formula)' for error log message, got: '${logErrorNode.step.inputs.message}'`
  );
});

// ============================================================================
// Genie skill, stop keyword, and new provider tests
// ============================================================================

test("genie skill trigger: recognized as genie_skill trigger type with schemas", () => {
  const recipe = {
    name: "Genie Skill Test",
    code: {
      keyword: "trigger",
      provider: "workato_genie",
      name: "start_workflow",
      as: "trigger",
      uuid: "trigger-001",
      input: {
        description: "Look up a user's manager",
        input_schema: '[{"name":"user_email","type":"string","label":"User email","optional":false}]',
        output_schema: '[{"name":"manager_email","type":"string","label":"Manager email"},{"name":"success","type":"boolean","label":"Success"}]',
      },
      extended_output_schema: [
        {
          label: "Parameters",
          name: "parameters",
          type: "object",
          properties: [
            { control_type: "text", label: "User email", name: "user_email", type: "string" },
          ],
        },
      ],
      block: [
        {
          keyword: "action",
          provider: "workato_genie",
          name: "workflow_return_result",
          as: "return_success",
          uuid: "return-001",
          number: 1,
          input: {
            result: { success: "true", manager_email: "mgr@example.com", error: "" },
          },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const triggerNode = graph.nodes.find((n) => n.kind === "trigger");
  assert(triggerNode !== undefined, "Should have trigger node");
  assert(triggerNode.ui?.triggerType === "genie_skill", `Expected genie_skill trigger type, got: ${triggerNode.ui?.triggerType}`);
  assert(triggerNode.ui?.badge === "Genie.start_workflow", `Expected Genie badge, got: ${triggerNode.ui?.badge}`);
  assert(triggerNode.inputSchema !== undefined, "Genie trigger should have input schema");
  assert(triggerNode.inputSchema!.length === 1, `Expected 1 input schema field, got ${triggerNode.inputSchema!.length}`);
  assert(triggerNode.inputSchema![0].name === "user_email", `Expected user_email field, got ${triggerNode.inputSchema![0].name}`);
  assert(triggerNode.outputSchema !== undefined, "Genie trigger should have output schema");
  assert(triggerNode.outputSchema!.length === 2, `Expected 2 output schema fields, got ${triggerNode.outputSchema!.length}`);
});

test("genie skill: workflow_return_result is terminal and connects to ::end", () => {
  const recipe = {
    name: "Genie Return Test",
    code: {
      keyword: "trigger",
      provider: "workato_genie",
      name: "start_workflow",
      as: "trigger",
      uuid: "trigger-001",
      input: {},
      block: [
        {
          keyword: "action",
          provider: "workato_genie",
          name: "workflow_return_result",
          as: "return_success",
          uuid: "return-001",
          number: 1,
          input: { result: { success: "true" } },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const returnNode = graph.nodes.find((n) => n.label === "return_success");
  assert(returnNode !== undefined, "Should have workflow_return_result node");
  assert(returnNode.ui?.isTerminal === true, "workflow_return_result should be terminal");

  const terminalEdge = graph.edges.find((e) => e.from === returnNode.id && e.to === "::end");
  assert(terminalEdge !== undefined, "Terminal node should connect to ::end");
  assert(terminalEdge.kind === "terminal", `Expected terminal edge kind, got: ${terminalEdge.kind}`);
});

test("genie skill: workflow_return_result extracts result fields as inputs", () => {
  const recipe = {
    name: "Genie Inputs Test",
    code: {
      keyword: "trigger",
      provider: "workato_genie",
      name: "start_workflow",
      as: "trigger",
      uuid: "trigger-001",
      input: {},
      block: [
        {
          keyword: "action",
          provider: "workato_genie",
          name: "workflow_return_result",
          as: "return_error",
          uuid: "return-err-001",
          number: 1,
          input: { result: { success: "false", error: "Not found" } },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const returnNode = graph.nodes.find((n) => n.label === "return_error");
  assert(returnNode !== undefined, "Should have return node");
  assert(returnNode.step?.inputs !== undefined, "Should have inputs");
  assert(returnNode.step.inputs["result.success"] === "false", `Expected result.success=false, got: ${returnNode.step.inputs["result.success"]}`);
  assert(returnNode.step.inputs["result.error"] === "Not found", `Expected result.error='Not found', got: ${returnNode.step.inputs["result.error"]}`);
});

test("stop keyword: renders as action node, not error node", () => {
  const recipe = {
    name: "Stop Test",
    code: {
      keyword: "trigger",
      provider: "test",
      name: "test",
      uuid: "trigger-001",
      block: [
        {
          keyword: "stop",
          uuid: "stop-001",
          number: 1,
          input: { stop_with_error: "false" },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const errorNodes = graph.nodes.filter((n) => n.kind === "error");
  assert(errorNodes.length === 0, `Expected no error nodes, got ${errorNodes.length}`);

  const stopNode = graph.nodes.find((n) => n.id === "stop-001");
  assert(stopNode !== undefined, "Should have stop node");
  assert(stopNode.kind === "action", `Expected action kind, got: ${stopNode.kind}`);
  assert(stopNode.ui?.isTerminal === true, "stop should be terminal");
});

test("stop keyword: connects to ::end as terminal", () => {
  const recipe = {
    name: "Stop Terminal Test",
    code: {
      keyword: "trigger",
      provider: "test",
      name: "test",
      uuid: "trigger-001",
      block: [
        {
          keyword: "stop",
          uuid: "stop-001",
          number: 1,
          input: { stop_with_error: "false" },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const terminalEdge = graph.edges.find((e) => e.from === "stop-001" && e.to === "::end");
  assert(terminalEdge !== undefined, "stop node should connect to ::end");
  assert(terminalEdge.kind === "terminal", `Expected terminal edge kind, got: ${terminalEdge.kind}`);
});

test("provider display names: new providers render correctly", () => {
  const recipe = {
    name: "Provider Names Test",
    code: {
      keyword: "trigger",
      provider: "workato_db_table",
      name: "new_record_v2",
      as: "new_row",
      uuid: "trigger-001",
      block: [
        {
          keyword: "action",
          provider: "py_eval",
          name: "invoke_custom_py_code",
          as: "extract_data",
          uuid: "py-001",
          number: 1,
        },
        {
          keyword: "action",
          provider: "workato_variable",
          name: "update_variables",
          as: "set_var",
          uuid: "var-001",
          number: 2,
        },
      ],
    },
  };

  const graph = buildIgm(recipe);

  const triggerNode = graph.nodes.find((n) => n.kind === "trigger");
  assert(triggerNode !== undefined, "Should have trigger node");
  assert(triggerNode.ui?.badge === "Data Table.new_record_v2", `Expected 'Data Table.new_record_v2', got: ${triggerNode.ui?.badge}`);

  const pyNode = graph.nodes.find((n) => n.label === "extract_data");
  assert(pyNode !== undefined, "Should have py_eval node");
  assert(pyNode.ui?.badge === "Python", `Expected 'Python' badge, got: ${pyNode.ui?.badge}`);

  const varNode = graph.nodes.find((n) => n.label === "set_var");
  assert(varNode !== undefined, "Should have variable node");
  assert(varNode.ui?.badge === "Variable", `Expected 'Variable' badge, got: ${varNode.ui?.badge}`);
});

// ============================================================================
// Golden fixture: API endpoint with stop
// ============================================================================

test("golden_api_endpoint_with_stop: transforms without errors", () => {
  const recipe = loadFixture("golden_api_endpoint_with_stop.recipe.json");
  const graph = buildIgm(recipe);

  const errorNodes = graph.nodes.filter((n) => n.kind === "error");
  assert(errorNodes.length === 0, `Expected no error nodes, got ${errorNodes.length}: ${errorNodes.map(n => n.label).join(", ")}`);
});

test("golden_api_endpoint_with_stop: graceful stop has label 'Stop' and stopWithError=false", () => {
  const recipe = loadFixture("golden_api_endpoint_with_stop.recipe.json");
  const graph = buildIgm(recipe);

  const stopNode = graph.nodes.find((n) => n.id === "stop-missing-input-008");
  assert(stopNode !== undefined, "Should have graceful stop node");
  assert(stopNode.label === "Stop", `Expected label 'Stop', got: '${stopNode.label}'`);
  assert(stopNode.ui?.stopWithError === false, `Expected stopWithError=false, got: ${stopNode.ui?.stopWithError}`);
  assert(stopNode.ui?.stopReason === "Request ID was not provided", `Expected stopReason, got: '${stopNode.ui?.stopReason}'`);
});

test("golden_api_endpoint_with_stop: error stop has stopWithError=true", () => {
  const recipe = loadFixture("golden_api_endpoint_with_stop.recipe.json");
  const graph = buildIgm(recipe);

  const stopNode = graph.nodes.find((n) => n.id === "stop-bad-status-006");
  assert(stopNode !== undefined, "Should have error stop node");
  assert(stopNode.label === "Stop", `Expected label 'Stop', got: '${stopNode.label}'`);
  assert(stopNode.ui?.stopWithError === true, `Expected stopWithError=true, got: ${stopNode.ui?.stopWithError}`);
  assert(stopNode.ui?.stopReason === "Processing failed — unexpected status from py_eval", `Expected stopReason, got: '${stopNode.ui?.stopReason}'`);
});

test("golden_api_endpoint_with_stop: both stop nodes are terminal connected to ::end", () => {
  const recipe = loadFixture("golden_api_endpoint_with_stop.recipe.json");
  const graph = buildIgm(recipe);

  const gracefulEdge = graph.edges.find((e) => e.from === "stop-missing-input-008" && e.to === "::end");
  assert(gracefulEdge !== undefined, "graceful stop should connect to ::end");
  assert(gracefulEdge.kind === "terminal", `Expected terminal edge kind, got: ${gracefulEdge.kind}`);

  const errorEdge = graph.edges.find((e) => e.from === "stop-bad-status-006" && e.to === "::end");
  assert(errorEdge !== undefined, "error stop should connect to ::end");
  assert(errorEdge.kind === "terminal", `Expected terminal edge kind, got: ${errorEdge.kind}`);
});

// ============================================================================
// Golden fixture: Data table trigger
// ============================================================================

test("golden_data_table_trigger: transforms without errors", () => {
  const recipe = loadFixture("golden_data_table_trigger.recipe.json");
  const graph = buildIgm(recipe);

  const errorNodes = graph.nodes.filter((n) => n.kind === "error");
  assert(errorNodes.length === 0, `Expected no error nodes, got ${errorNodes.length}: ${errorNodes.map(n => n.label).join(", ")}`);
});

test("golden_data_table_trigger: trigger node has correct provider badge and type", () => {
  const recipe = loadFixture("golden_data_table_trigger.recipe.json");
  const graph = buildIgm(recipe);

  const triggerNode = graph.nodes.find((n) => n.kind === "trigger");
  assert(triggerNode !== undefined, "Should have trigger node");
  assert(triggerNode.ui?.badge === "Data Table.updated_records_realtime", `Expected 'Data Table.updated_records_realtime', got: '${triggerNode.ui?.badge}'`);
  assert(triggerNode.ui?.triggerType === "data_table", `Expected trigger type 'data_table', got: '${triggerNode.ui?.triggerType}'`);
});

// ============================================================================
// Stop metadata: stop_with_error=true
// ============================================================================

test("stop keyword: stopWithError=true is captured", () => {
  const recipe = {
    name: "Stop Error Test",
    code: {
      keyword: "trigger",
      provider: "test",
      name: "test",
      uuid: "trigger-001",
      block: [
        {
          keyword: "stop",
          uuid: "stop-001",
          number: 1,
          input: { stop_with_error: "true", stop_reason: "Something went wrong" },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);
  const stopNode = graph.nodes.find((n) => n.id === "stop-001");
  assert(stopNode !== undefined, "Should have stop node");
  assert(stopNode.ui?.stopWithError === true, `Expected stopWithError=true, got: ${stopNode.ui?.stopWithError}`);
  assert(stopNode.ui?.stopReason === "Something went wrong", `Expected stopReason, got: '${stopNode.ui?.stopReason}'`);
  assert(stopNode.label === "Stop", `Expected label 'Stop', got: '${stopNode.label}'`);
});

test("stop keyword: label uses step.as when present", () => {
  const recipe = {
    name: "Stop With Alias",
    code: {
      keyword: "trigger",
      provider: "test",
      name: "test",
      uuid: "trigger-001",
      block: [
        {
          keyword: "stop",
          as: "halt_processing",
          uuid: "stop-001",
          number: 1,
          input: { stop_with_error: "false" },
        },
      ],
    },
  };

  const graph = buildIgm(recipe);
  const stopNode = graph.nodes.find((n) => n.id === "stop-001");
  assert(stopNode !== undefined, "Should have stop node");
  assert(stopNode.label === "halt_processing", `Expected label 'halt_processing', got: '${stopNode.label}'`);
});

// ============================================================================
// Golden fixture: Message topic subscriber
// ============================================================================

test("golden_msg_topic_subscriber: transforms without errors", () => {
  const recipe = loadFixture("golden_msg_topic_subscriber.recipe.json");
  const graph = buildIgm(recipe);

  const errorNodes = graph.nodes.filter((n) => n.kind === "error");
  assert(errorNodes.length === 0, `Expected no error nodes, got ${errorNodes.length}: ${errorNodes.map(n => n.label).join(", ")}`);
});

test("golden_msg_topic_subscriber: trigger is event_streams type with correct badge", () => {
  const recipe = loadFixture("golden_msg_topic_subscriber.recipe.json");
  const graph = buildIgm(recipe);

  const triggerNode = graph.nodes.find((n) => n.kind === "trigger");
  assert(triggerNode !== undefined, "Should have trigger node");
  assert(triggerNode.ui?.triggerType === "event_streams", `Expected trigger type 'event_streams', got: '${triggerNode.ui?.triggerType}'`);
  assert(triggerNode.ui?.badge === "Event Streams.subscribe_to_topic", `Expected 'Event Streams.subscribe_to_topic', got: '${triggerNode.ui?.badge}'`);
});

// ============================================================================
// Golden fixture: Message topic publisher
// ============================================================================

test("golden_msg_topic_publisher: transforms without errors", () => {
  const recipe = loadFixture("golden_msg_topic_publisher.recipe.json");
  const graph = buildIgm(recipe);

  const errorNodes = graph.nodes.filter((n) => n.kind === "error");
  assert(errorNodes.length === 0, `Expected no error nodes, got ${errorNodes.length}: ${errorNodes.map(n => n.label).join(", ")}`);
});

test("golden_msg_topic_publisher: publish action has Event Streams badge", () => {
  const recipe = loadFixture("golden_msg_topic_publisher.recipe.json");
  const graph = buildIgm(recipe);

  const publishNode = graph.nodes.find((n) => n.id === "publish-event-001");
  assert(publishNode !== undefined, "Should have publish action node");
  assert(publishNode.ui?.badge === "Event Streams", `Expected 'Event Streams' badge, got: '${publishNode.ui?.badge}'`);
});

console.log("\n=== All tests complete ===\n");
