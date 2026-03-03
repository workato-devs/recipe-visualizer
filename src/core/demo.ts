/**
 * Demo script to output IGM graph as JSON
 * Run with: npx tsx core/demo.ts [fixture-name]
 */

import { buildIgm } from "./transformer";
import { readFileSync } from "fs";
import { join } from "path";

const fixtureName = process.argv[2] ?? "upsert_contact.recipe.json";
const fixturePath = join(__dirname, "..", "fixtures", fixtureName);

console.log(`Loading fixture: ${fixturePath}\n`);

const recipeJson = JSON.parse(readFileSync(fixturePath, "utf-8"));
const graph = buildIgm(recipeJson);

console.log("=== Recipe Metadata ===");
console.log(JSON.stringify(graph.meta, null, 2));

console.log("\n=== Nodes ===");
for (const node of graph.nodes) {
  const terminal = node.ui?.isTerminal ? " [TERMINAL]" : "";
  const status = node.ui?.httpStatus ? ` (${node.ui.httpStatus})` : "";
  console.log(`  ${node.id} (${node.kind}): ${node.label}${terminal}${status}`);
}

console.log("\n=== Edges ===");
for (const edge of graph.edges) {
  console.log(`  ${edge.from} --[${edge.kind}]--> ${edge.to}`);
}

console.log("\n=== Statistics ===");
console.log(`  Nodes: ${graph.nodes.length}`);
console.log(`  Edges: ${graph.edges.length}`);
console.log(`  Roots: ${graph.roots.join(", ")}`);

if (graph.diagnostics?.length) {
  console.log("\n=== Diagnostics ===");
  for (const d of graph.diagnostics) {
    console.log(`  [${d.level}] ${d.message}`);
  }
}

// Output full JSON for debugging
console.log("\n=== Full IGM Graph JSON ===");
console.log(JSON.stringify(graph, null, 2));
