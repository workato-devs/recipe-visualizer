/**
 * Recipe Visualizer Webview Panel
 */

import * as vscode from "vscode";
import { buildIgm } from "../core/transformer";
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "../shared/messages";
import { jsonPointerToPosition, positionToJsonPointer } from "./jsonPointer";

export class RecipeVisualizerPanel {
  public static currentPanel: RecipeVisualizerPanel | undefined;

  public static readonly viewType = "recipeVisualizer";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _document: vscode.TextDocument;
  private _disposables: vscode.Disposable[] = [];

  // Track if webview panel is currently active/focused
  private _isActive = false;

  public static createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument
  ) {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (RecipeVisualizerPanel.currentPanel) {
      RecipeVisualizerPanel.currentPanel._document = document;
      RecipeVisualizerPanel.currentPanel._updateGraph();
      RecipeVisualizerPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      RecipeVisualizerPanel.viewType,
      "Recipe Visualizer",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
      }
    );

    RecipeVisualizerPanel.currentPanel = new RecipeVisualizerPanel(
      panel,
      extensionUri,
      document
    );
  }

  public static updateIfActive(document: vscode.TextDocument) {
    if (
      RecipeVisualizerPanel.currentPanel &&
      RecipeVisualizerPanel.currentPanel._document.uri.toString() ===
        document.uri.toString()
    ) {
      RecipeVisualizerPanel.currentPanel._document = document;
      RecipeVisualizerPanel.currentPanel._updateGraph();
    }
  }

  public static switchToDocument(document: vscode.TextDocument) {
    if (RecipeVisualizerPanel.currentPanel) {
      RecipeVisualizerPanel.currentPanel._document = document;
      RecipeVisualizerPanel.currentPanel._updateGraph();
    }
  }

  public static closeIfDocumentClosed(document: vscode.TextDocument) {
    const panel = RecipeVisualizerPanel.currentPanel;
    if (!panel) return;

    // Close panel if this is the document we're visualizing
    if (panel._document.uri.toString() === document.uri.toString()) {
      panel.dispose();
    }
  }

  public static syncSelection(editor: vscode.TextEditor) {
    const panel = RecipeVisualizerPanel.currentPanel;
    if (!panel) return;

    // Only sync if this is the document we're visualizing
    if (panel._document.uri.toString() !== editor.document.uri.toString()) {
      return;
    }

    // Skip sync if webview is active - user is interacting there
    // This prevents feedback loops and lets the webview "own" selection when focused
    if (panel._isActive) {
      return;
    }

    const position = editor.selection.active;
    const documentText = editor.document.getText();
    const jsonPointer = positionToJsonPointer(documentText, position);

    const message: ExtensionToWebviewMessage = {
      type: "updateSelection",
      jsonPointer,
    };

    panel._panel.webview.postMessage(message);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._document = document;

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview();

    // Track initial active state
    this._isActive = this._panel.active;

    // Track panel active state changes
    this._panel.onDidChangeViewState(
      (e) => {
        this._isActive = e.webviewPanel.active;
      },
      null,
      this._disposables
    );

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    RecipeVisualizerPanel.currentPanel = undefined;

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _handleMessage(message: WebviewToExtensionMessage) {
    switch (message.type) {
      case "webviewReady":
        this._updateGraph();
        break;

      case "nodeSelected":
        // Could update status bar or show node details
        break;

      case "navigateToSource":
        this._navigateToSource(message.jsonPointer, message.uuid);
        break;

      case "openCalledRecipe":
        this._openCalledRecipe(message.zipName, message.recipeName);
        break;
    }
  }

  private _navigateToSource(jsonPointer: string, uuid?: string) {
    const documentText = this._document.getText();
    let position: vscode.Position | null = null;

    // Always use JSON pointer for position — it points to the start of the
    // step object (the opening `{`), which is the most useful anchor.
    // UUID search lands on the `"uuid"` key *inside* the object, which is
    // less helpful and causes inconsistent scroll behaviour.
    position = jsonPointerToPosition(documentText, jsonPointer);

    // Fall back to UUID-based search if pointer resolution failed
    if (!position && uuid) {
      position = this._findUuidPosition(documentText, uuid);
    }

    if (position) {
      // Navigate to source and give editor focus
      // No sync guard needed - panel becomes inactive when editor gets focus,
      // so syncSelection naturally skips (checks _isActive)
      vscode.window.showTextDocument(this._document, {
        selection: new vscode.Selection(position, position),
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      }).then((editor) => {
        // Explicitly reveal the target line at the top of the viewport.
        // showTextDocument's default reveal uses minimal scrolling, which
        // may leave the target line anywhere in the viewport (often the
        // bottom for large JSON objects). AtTop is always consistent.
        editor.revealRange(
          new vscode.Range(position!, position!),
          vscode.TextEditorRevealType.AtTop,
        );
      });
    }
  }

  private _findUuidPosition(documentText: string, uuid: string): vscode.Position | null {
    // Search for the UUID in the document
    const uuidPattern = `"uuid"\\s*:\\s*"${uuid}"`;
    const regex = new RegExp(uuidPattern);
    const match = regex.exec(documentText);

    if (match) {
      // Convert offset to position
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

      return new vscode.Position(line, col);
    }

    return null;
  }

  private async _openCalledRecipe(zipName: string, recipeName?: string) {
    // zipName is relative path like "atomic-salesforce-recipes/search_contact_by_email.recipe.json"

    // Get workspace folder from current document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(this._document.uri);
    if (!workspaceFolder) {
      vscode.window.showWarningMessage(`Cannot find workspace for recipe lookup`);
      return;
    }

    // Search for the file by glob pattern
    const pattern = new vscode.RelativePattern(workspaceFolder, `**/${zipName}`);
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);

    if (files.length > 0) {
      const doc = await vscode.workspace.openTextDocument(files[0]);
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
      RecipeVisualizerPanel.createOrShow(this._extensionUri, doc);
      return;
    }

    // Fallback: try just the filename
    const fileName = zipName.split('/').pop();
    if (fileName) {
      const fallbackPattern = new vscode.RelativePattern(workspaceFolder, `**/${fileName}`);
      const fallbackFiles = await vscode.workspace.findFiles(fallbackPattern, '**/node_modules/**', 1);

      if (fallbackFiles.length > 0) {
        const doc = await vscode.workspace.openTextDocument(fallbackFiles[0]);
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
        RecipeVisualizerPanel.createOrShow(this._extensionUri, doc);
        return;
      }
    }

    // Not found
    vscode.window.showWarningMessage(
      `Recipe "${recipeName || zipName}" not found in workspace`
    );
  }

  private _updateGraph() {
    try {
      const content = this._document.getText();
      const recipeJson = JSON.parse(content);
      const graph = buildIgm(recipeJson);

      const message: ExtensionToWebviewMessage = {
        type: "renderGraph",
        graph,
        documentUri: this._document.uri.toString(),
      };

      this._panel.webview.postMessage(message);
    } catch (e) {
      console.error("Failed to build IGM:", e);
      vscode.window.showErrorMessage(
        `Failed to parse recipe: ${(e as Error).message}`
      );
    }
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // Get URIs for webview resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview", "assets", "index.css")
    );

    // Use a nonce to only allow specific scripts to run
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
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
