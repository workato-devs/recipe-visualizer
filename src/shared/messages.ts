/**
 * Message protocol between extension host and webview
 */

import { IgmGraph } from "./types";

// ============================================================================
// Extension → Webview Messages
// ============================================================================

export interface RenderGraphMessage {
  type: "renderGraph";
  graph: IgmGraph;
  documentUri: string;
}

export interface UpdateSelectionMessage {
  type: "updateSelection";
  jsonPointer: string | null;
}

export type ExtensionToWebviewMessage = RenderGraphMessage | UpdateSelectionMessage;

// ============================================================================
// Webview → Extension Messages
// ============================================================================

export interface NavigateToSourceMessage {
  type: "navigateToSource";
  jsonPointer: string;
  uuid?: string;  // UUID for accurate navigation
}

export interface NodeSelectedMessage {
  type: "nodeSelected";
  nodeId: string;
  jsonPointer: string;
  uuid?: string;  // UUID for accurate navigation
}

export interface WebviewReadyMessage {
  type: "webviewReady";
}

export interface OpenCalledRecipeMessage {
  type: "openCalledRecipe";
  /** Relative path like "folder/recipe.recipe.json" */
  zipName: string;
  /** For display in error messages */
  recipeName?: string;
}

export type WebviewToExtensionMessage =
  | NavigateToSourceMessage
  | NodeSelectedMessage
  | WebviewReadyMessage
  | OpenCalledRecipeMessage;
