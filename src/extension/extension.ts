/**
 * VS Code Extension Entry Point
 */

import * as vscode from "vscode";
import { RecipeVisualizerPanel } from "./RecipeVisualizerPanel";

export function activate(context: vscode.ExtensionContext) {
  console.log("Recipe Visualizer extension activated");

  // Register command to open visualizer
  const openVisualizerCommand = vscode.commands.registerCommand(
    "recipeVisualizer.open",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isRecipeFile(editor.document)) {
        RecipeVisualizerPanel.createOrShow(context.extensionUri, editor.document);
      } else {
        vscode.window.showWarningMessage(
          "Please open a recipe JSON file to visualize"
        );
      }
    }
  );

  // Register command to open visualizer from context menu
  const openFromContextCommand = vscode.commands.registerCommand(
    "recipeVisualizer.openFromContext",
    (uri: vscode.Uri) => {
      vscode.workspace.openTextDocument(uri).then((document) => {
        if (isRecipeFile(document)) {
          RecipeVisualizerPanel.createOrShow(context.extensionUri, document);
        } else {
          vscode.window.showWarningMessage("This does not appear to be a recipe JSON file");
        }
      });
    }
  );

  // Watch for document changes to update visualization
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
    if (isRecipeFile(e.document)) {
      RecipeVisualizerPanel.updateIfActive(e.document);
    }
  });

  // Watch for document saves to update visualization
  const documentSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
    if (isRecipeFile(document)) {
      RecipeVisualizerPanel.updateIfActive(document);
    }
  });

  // Watch for editor selection changes
  const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (isRecipeFile(e.textEditor.document)) {
      RecipeVisualizerPanel.syncSelection(e.textEditor);
    }
  });

  // Watch for document close to close visualization
  const documentCloseListener = vscode.workspace.onDidCloseTextDocument((document) => {
    RecipeVisualizerPanel.closeIfDocumentClosed(document);
  });

  context.subscriptions.push(
    openVisualizerCommand,
    openFromContextCommand,
    documentChangeListener,
    documentSaveListener,
    selectionChangeListener,
    documentCloseListener
  );
}

export function deactivate() {
  console.log("Recipe Visualizer extension deactivated");
}

/**
 * Check if a document is a recipe JSON file
 */
function isRecipeFile(document: vscode.TextDocument): boolean {
  if (document.languageId !== "json") return false;

  // Check file name pattern
  if (document.fileName.endsWith(".recipe.json")) return true;

  // Check content for recipe-like structure
  try {
    const content = document.getText();
    const json = JSON.parse(content);
    return (
      typeof json === "object" &&
      json !== null &&
      "code" in json &&
      typeof json.code === "object" &&
      "keyword" in json.code
    );
  } catch {
    return false;
  }
}
