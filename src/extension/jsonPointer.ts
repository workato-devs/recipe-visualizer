/**
 * JSON Pointer utilities for source navigation
 * Uses jsonc-parser for accurate position mapping
 */

import * as vscode from "vscode";
import { parseTree, findNodeAtLocation, Node as JsonNode } from "jsonc-parser/lib/esm/main.js";

/**
 * Convert a JSON Pointer to a Position in the document
 */
export function jsonPointerToPosition(
  documentText: string,
  jsonPointer: string
): vscode.Position | null {
  if (!jsonPointer || jsonPointer === "/") {
    return new vscode.Position(0, 0);
  }

  // Parse the document into an AST
  const root = parseTree(documentText);
  if (!root) {
    return new vscode.Position(0, 0);
  }

  // Convert JSON Pointer to path segments
  const segments = jsonPointerToPath(jsonPointer);
  if (segments.length === 0) {
    return new vscode.Position(0, 0);
  }

  // Find the node at the path
  const node = findNodeAtLocation(root, segments);
  if (!node) {
    // Fallback: try to find the parent and return its position
    const parentSegments = segments.slice(0, -1);
    const parentNode = parentSegments.length > 0
      ? findNodeAtLocation(root, parentSegments)
      : root;
    if (parentNode) {
      return offsetToPosition(documentText, parentNode.offset);
    }
    return new vscode.Position(0, 0);
  }

  // Convert offset to position
  return offsetToPosition(documentText, node.offset);
}

/**
 * Convert a JSON Pointer to a Range in the document
 */
export function jsonPointerToRange(
  documentText: string,
  jsonPointer: string
): vscode.Range | null {
  if (!jsonPointer || jsonPointer === "/") {
    return new vscode.Range(0, 0, 0, 0);
  }

  const root = parseTree(documentText);
  if (!root) {
    return null;
  }

  const segments = jsonPointerToPath(jsonPointer);
  const node = findNodeAtLocation(root, segments);
  if (!node) {
    return null;
  }

  const start = offsetToPosition(documentText, node.offset);
  const end = offsetToPosition(documentText, node.offset + node.length);

  if (!start || !end) {
    return null;
  }

  return new vscode.Range(start, end);
}

/**
 * Convert a Position to a JSON Pointer
 */
export function positionToJsonPointer(
  documentText: string,
  position: vscode.Position
): string | null {
  const root = parseTree(documentText);
  if (!root) {
    return null;
  }

  // Convert position to offset
  const offset = positionToOffset(documentText, position);
  if (offset === null) {
    return null;
  }

  // Find the path to the node at this offset
  const path = findPathAtOffset(root, offset);
  if (!path || path.length === 0) {
    return "/";
  }

  // Convert path to JSON Pointer
  return pathToJsonPointer(path);
}

/**
 * Find the JSON path at a given offset
 */
function findPathAtOffset(node: JsonNode, offset: number, path: (string | number)[] = []): (string | number)[] | null {
  // Check if offset is within this node
  if (offset < node.offset || offset > node.offset + node.length) {
    return null;
  }

  // If this node has children, try to find a more specific match
  if (node.children) {
    if (node.type === "object") {
      // Object: children are property nodes
      for (const prop of node.children) {
        if (prop.children && prop.children.length >= 2) {
          const keyNode = prop.children[0];
          const valueNode = prop.children[1];

          // Check if offset is in the value
          if (offset >= valueNode.offset && offset <= valueNode.offset + valueNode.length) {
            const key = keyNode.value as string;
            const result = findPathAtOffset(valueNode, offset, [...path, key]);
            if (result) {
              return result;
            }
            // If no deeper match, return path including this key
            return [...path, key];
          }
        }
      }
    } else if (node.type === "array") {
      // Array: children are array elements
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

  // No more specific match found, return current path
  return path.length > 0 ? path : null;
}

/**
 * Convert JSON Pointer string to path array
 */
function jsonPointerToPath(pointer: string): (string | number)[] {
  if (!pointer || pointer === "/") {
    return [];
  }

  return pointer
    .split("/")
    .slice(1) // Remove leading empty string
    .map((segment) => {
      // Unescape JSON Pointer special characters
      const unescaped = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      // Try to parse as number for array indices
      const num = parseInt(unescaped, 10);
      return !isNaN(num) && String(num) === unescaped ? num : unescaped;
    });
}

/**
 * Convert path array to JSON Pointer string
 */
function pathToJsonPointer(path: (string | number)[]): string {
  if (path.length === 0) {
    return "/";
  }

  return "/" + path
    .map((segment) => {
      const str = String(segment);
      // Escape JSON Pointer special characters
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    })
    .join("/");
}

/**
 * Convert document offset to Position
 */
function offsetToPosition(documentText: string, offset: number): vscode.Position | null {
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

/**
 * Convert Position to document offset
 */
function positionToOffset(documentText: string, position: vscode.Position): number | null {
  const lines = documentText.split("\n");

  if (position.line >= lines.length) {
    return null;
  }

  let offset = 0;

  // Add length of all previous lines (including newlines)
  for (let i = 0; i < position.line; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }

  // Add column offset
  offset += Math.min(position.character, lines[position.line].length);

  return offset;
}
