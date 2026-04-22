/**
 * Export IGM graph as normalized JSON for snapshot comparison with Go implementation.
 * Usage: npx tsx core/snapshot-export.ts <recipe-file-path>
 *
 * Outputs a normalized JSON object with:
 *   - nodes: sorted by id, with only id/kind/label/isTerminal/stepAs/provider/parentKind
 *   - edges: sorted by id, with only id/from/to/kind
 *   - roots: sorted
 *   - aliasMap: step.as → nodeId
 */

import { buildIgm } from "./transformer";
import { readFileSync } from "fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx core/snapshot-export.ts <recipe-file-path>");
  process.exit(1);
}

const recipeJson = JSON.parse(readFileSync(filePath, "utf-8"));
const graph = buildIgm(recipeJson);

// Build alias map from the graph's internal state
// We need to reconstruct it from nodes since buildIgm doesn't expose aliasMap directly
const aliasMap: Record<string, string> = {};
for (const node of graph.nodes) {
  if (node.step?.as) {
    aliasMap[node.step.as] = node.id;
  }
}

// Normalize nodes: extract only fields relevant for linter comparison
const nodes = graph.nodes.map((n) => ({
  id: n.id,
  kind: n.kind,
  label: n.label,
  pointer: n.source.jsonPointer,
  is_terminal: !!n.ui?.isTerminal,
  provider: n.step?.provider ?? null,
  step_as: n.step?.as ?? "",
  step_name: n.step?.name ?? "",
  http_status: n.ui?.httpStatus ?? "",
})).sort((a, b) => a.id.localeCompare(b.id));

// Normalize edges
const edges = graph.edges.map((e) => ({
  id: e.id,
  from: e.from,
  to: e.to,
  kind: e.kind,
})).sort((a, b) => a.id.localeCompare(b.id));

const roots = [...(graph.roots ?? [])].sort();

const output = { nodes, edges, roots, alias_map: aliasMap };

console.log(JSON.stringify(output, null, 2));
