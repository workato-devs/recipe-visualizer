#!/usr/bin/env npx tsx
/**
 * Validate a recipe JSON file by running it through the IGM transformer.
 * Accepts an absolute file path (unlike demo.ts which resolves from fixtures/).
 *
 * Usage: npx tsx validate-transform.ts /absolute/path/to/recipe.json
 */

import { buildIgm } from "./core/transformer";
import { readFileSync } from "fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx validate-transform.ts <absolute-path-to-recipe.json>");
  process.exit(1);
}

const recipeJson = JSON.parse(readFileSync(filePath, "utf-8"));
const graph = buildIgm(recipeJson);

console.log(JSON.stringify({
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  roots: graph.roots,
  diagnostics: graph.diagnostics ?? [],
}, null, 2));

if (graph.diagnostics?.length) {
  process.exit(1);
}
