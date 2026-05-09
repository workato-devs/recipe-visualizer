import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { toPng, toSvg } from "html-to-image";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { IgmGraph, IgmNode, IgmEdge } from "../../shared/types";
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "../../shared/messages";
import {
  applyLayout,
  LayoutDirection,
  LayoutOptions,
  DEFAULT_LAYOUT_OPTIONS,
} from "./useLayout";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { NodeDetailsPanel } from "./NodeDetailsPanel";

// Debug tools - only imported in development
import {
  DebugToggleButton,
  DebugPanel,
  SwimLaneOverlay,
  useDebugState,
} from "./debug";

// VS Code API acquisition (only available when running in VS Code webview)
interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

function getVsCodeApi(): VsCodeApi | null {
  try {
    if (typeof (window as any).acquireVsCodeApi === "function") {
      return (window as any).acquireVsCodeApi();
    }
  } catch {
    // Not in VS Code
  }
  return null;
}

const vscode = getVsCodeApi();

/**
 * Find the node whose JSON pointer best matches the given pointer.
 * Looks for exact match first, then finds the longest matching prefix.
 */
function findNodeForPointer(nodes: IgmNode[], pointer: string): IgmNode | null {
  // Exact match
  const exactMatch = nodes.find(n => n.source.jsonPointer === pointer);
  if (exactMatch) {
    return exactMatch;
  }

  // Find the node with the longest matching pointer prefix
  let bestMatch: IgmNode | null = null;
  let bestLength = 0;

  for (const node of nodes) {
    const nodePointer = node.source.jsonPointer;
    // Check if the cursor pointer starts with this node's pointer
    if (pointer.startsWith(nodePointer) && nodePointer.length > bestLength) {
      // Make sure it's a proper prefix (followed by / or end)
      const rest = pointer.slice(nodePointer.length);
      if (rest === "" || rest.startsWith("/")) {
        bestMatch = node;
        bestLength = nodePointer.length;
      }
    }
  }

  return bestMatch;
}

/**
 * Check if an edge is a loop-back edge (goes from body back to foreach node)
 */
function isLoopBackEdge(edge: IgmEdge, nodes: IgmNode[]): boolean {
  if (edge.kind !== "loop") return false;
  // Check if target is a foreach node
  const targetNode = nodes.find(n => n.id === edge.to);
  return targetNode?.kind === "foreach";
}

/**
 * Convert IGM graph to React Flow format (without layout)
 */
function igmToReactFlow(graph: IgmGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n: IgmNode) => ({
    id: n.id,
    type: getNodeType(n),
    data: {
      label: n.label,
      kind: n.kind,
      ui: n.ui,
      step: n.step,
      source: n.source,
      inputSchema: n.inputSchema,
      outputSchema: n.outputSchema,
    },
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = graph.edges.map((e: IgmEdge) => {
    const label = getEdgeLabel(e);
    const isBackEdge = isLoopBackEdge(e, graph.nodes);

    const baseEdge = {
      id: e.id,
      source: e.from,
      target: e.to,
      // Use custom loopBack edge type for back-edges, smoothstep for others
      type: isBackEdge ? "loopBack" : "smoothstep",
      animated: e.kind === "data",
      style: getEdgeStyle(e),
      markerEnd: undefined,
      markerStart: undefined,
    };

    if (label) {
      return {
        ...baseEdge,
        label,
        labelStyle: {
          fill: getEdgeLabelColor(e),
          fontSize: 9,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "var(--vscode-editor-background, #1e1e1e)",
          fillOpacity: 0.8,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
    }

    return baseEdge;
  });

  return { nodes, edges };
}


/**
 * Map IGM node kind to React Flow node type
 */
function getNodeType(node: IgmNode): string {
  switch (node.kind) {
    case "trigger":
      return "triggerNode";
    case "action":
      return node.ui?.isTerminal ? "terminalNode" : "actionNode";
    case "if":
    case "try":
      return "controlNode";
    case "catch":
      return "catchNode";
    case "foreach":
      return "foreachNode";
    case "branch":
      return "branchNode";
    case "end":
      return "endNode";
    case "error":
      return "errorNode";
    default:
      return "default";
  }
}

/**
 * Get edge label based on kind
 */
function getEdgeLabel(edge: IgmEdge): string | undefined {
  switch (edge.kind) {
    case "true":
      return "yes";
    case "false":
      return "no";
    case "error":
      return "error";
    case "loop":
      return "repeat";
    case "exit":
      return "exit";
    case "terminal":
      return undefined; // No label needed
    case "next":
      return undefined; // No label for sequential flow
    case "data":
      return edge.label ?? "data";
    default:
      return undefined;
  }
}

/**
 * Get edge label color based on kind
 */
function getEdgeLabelColor(edge: IgmEdge): string {
  switch (edge.kind) {
    case "true":
      return "#22c55e";
    case "false":
      return "#ef4444";
    case "error":
      return "#ef4444";
    case "loop":
      return "#8b5cf6";
    case "exit":
      return "#8b5cf6"; // Same purple as loop for visual consistency
    case "data":
      return "#3b82f6";
    default:
      return "#9ca3af";
  }
}

/**
 * Get edge style based on kind
 */
function getEdgeStyle(edge: IgmEdge): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    strokeWidth: 2,
  };

  switch (edge.kind) {
    case "next":
      return { ...baseStyle, stroke: "#6b7280" };
    case "true":
      return { ...baseStyle, stroke: "#22c55e" };
    case "false":
      return { ...baseStyle, stroke: "#ef4444" };
    case "error":
      return { ...baseStyle, stroke: "#ef4444", strokeDasharray: "5,5" };
    case "loop":
      return { ...baseStyle, stroke: "#8b5cf6", strokeDasharray: "4,4" };
    case "exit":
      return { ...baseStyle, stroke: "#8b5cf6" }; // Solid purple line for exit
    case "terminal":
      return { ...baseStyle, stroke: "#6b7280", strokeDasharray: "3,3" };
    case "data":
      return { ...baseStyle, stroke: "#3b82f6", strokeDasharray: "2,2" };
    default:
      return baseStyle;
  }
}

// Import all fixtures dynamically via Vite glob
import { buildIgm } from "../../core/transformer";

const fixtureModules = import.meta.glob("../../fixtures/*.recipe.json", { eager: true }) as Record<string, { default: unknown }>;

const demoGraphs: Record<string, IgmGraph> = {
  simple: {
    nodes: [
      { id: "demo-trigger", kind: "trigger", label: "API Trigger", source: { jsonPointer: "/code" }, ui: { triggerType: "api_endpoint" } },
      { id: "demo-action", kind: "action", label: "Process Data", source: { jsonPointer: "/code/block/0" }, ui: { badge: "Logger" } },
      { id: "::end", kind: "end", label: "End", source: { jsonPointer: "/" } },
    ],
    edges: [
      { id: "e1", from: "demo-trigger", to: "demo-action", kind: "next" },
      { id: "e2", from: "demo-action", to: "::end", kind: "next" },
    ],
    roots: ["demo-trigger"],
    meta: { name: "Simple Demo", version: 1, private: true, concurrency: 1, connections: [] },
  },
};

for (const [path, mod] of Object.entries(fixtureModules)) {
  const filename = path.split("/").pop()!.replace(".recipe.json", "");
  const key = filename.replace(/[^a-zA-Z0-9]/g, "_");
  const recipe = (mod as any).default ?? mod;
  demoGraphs[key] = buildIgm(recipe);
}

// Search bar component (must be inside ReactFlow)
function SearchBar({
  graph,
  onSelectNode
}: {
  graph: IgmGraph | null;
  onSelectNode: (node: IgmNode) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const { setCenter, getNodes } = useReactFlow();

  // Find matching nodes
  const matches = useMemo(() => {
    if (!graph || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return graph.nodes.filter(n => {
      const label = n.label?.toLowerCase() ?? "";
      const provider = n.step?.provider?.toLowerCase() ?? "";
      const name = n.step?.name?.toLowerCase() ?? "";
      const alias = n.step?.as?.toLowerCase() ?? "";
      const httpStatus = n.ui?.httpStatus?.toLowerCase() ?? "";

      // Search in step inputs (e.g., "success", "true", "200")
      const inputs = n.step?.inputs ?? {};
      const inputValues = Object.entries(inputs)
        .map(([k, v]) => `${k}:${v}`.toLowerCase())
        .join(" ");

      return (
        label.includes(query) ||
        provider.includes(query) ||
        name.includes(query) ||
        alias.includes(query) ||
        httpStatus.includes(query) ||
        inputValues.includes(query)
      );
    });
  }, [graph, searchQuery]);

  // Reset index when matches change
  useEffect(() => {
    setMatchIndex(0);
  }, [matches.length]);

  // Focus on current match
  const focusMatch = useCallback((index: number) => {
    if (matches.length === 0) return;
    const match = matches[index];
    const flowNodes = getNodes();
    const flowNode = flowNodes.find(n => n.id === match.id);
    if (flowNode && flowNode.position) {
      setCenter(flowNode.position.x + 100, flowNode.position.y + 30, { zoom: 1.5, duration: 300 });
      onSelectNode(match);
    }
  }, [matches, getNodes, setCenter, onSelectNode]);

  const goToNext = () => {
    const newIndex = (matchIndex + 1) % matches.length;
    setMatchIndex(newIndex);
    focusMatch(newIndex);
  };

  const goToPrev = () => {
    const newIndex = (matchIndex - 1 + matches.length) % matches.length;
    setMatchIndex(newIndex);
    focusMatch(newIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.shiftKey) goToPrev();
      else goToNext();
    }
    if (e.key === "Escape") {
      setSearchQuery("");
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 10px",
        backgroundColor: "var(--vscode-editor-background)",
        border: "1px solid var(--vscode-panel-border)",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        zIndex: 10,
      }}
    >
      <span style={{ opacity: 0.7 }}>🔍</span>
      <input
        type="text"
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: "var(--vscode-input-background)",
          color: "var(--vscode-input-foreground)",
          border: "1px solid var(--vscode-input-border)",
          borderRadius: 3,
          padding: "4px 8px",
          width: 160,
          outline: "none",
        }}
      />
      {searchQuery && (
        <>
          <span style={{ opacity: 0.7, minWidth: 50, textAlign: "center" }}>
            {matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : "0/0"}
          </span>
          <button
            onClick={goToPrev}
            disabled={matches.length === 0}
            style={{
              padding: "2px 6px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "none",
              borderRadius: 3,
              cursor: matches.length > 0 ? "pointer" : "default",
              opacity: matches.length > 0 ? 1 : 0.5,
            }}
          >
            ▲
          </button>
          <button
            onClick={goToNext}
            disabled={matches.length === 0}
            style={{
              padding: "2px 6px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "none",
              borderRadius: 3,
              cursor: matches.length > 0 ? "pointer" : "default",
              opacity: matches.length > 0 ? 1 : 0.5,
            }}
          >
            ▼
          </button>
          <button
            onClick={() => setSearchQuery("")}
            style={{
              padding: "2px 6px",
              backgroundColor: "transparent",
              color: "var(--vscode-foreground)",
              border: "none",
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [graph, setGraph] = useState<IgmGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<IgmNode | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedDemo, setSelectedDemo] = useState<string>("ha_api_control_light");
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("horizontal");
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(false);

  // Layout options used for non-debug mode (production defaults)
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>(DEFAULT_LAYOUT_OPTIONS);

  // Mark as ready after initial mount
  useEffect(() => {
    mountedRef.current = true;
    // Small delay to ensure React Flow is fully initialized
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Load a graph (async due to ELK layout)
  const loadGraph = useCallback(async (
    g: IgmGraph,
    direction: LayoutDirection = layoutDirection,
    options: LayoutOptions = layoutOptions
  ) => {
    setGraph(g);
    const { nodes: newNodes, edges: newEdges } = igmToReactFlow(g);

    // Add layout direction to node data
    const nodesWithDirection = newNodes.map(node => ({
      ...node,
      data: { ...node.data, layoutDirection: direction },
    }));

    // Apply ELK layout asynchronously with options
    const layoutedNodes = await applyLayout(nodesWithDirection, newEdges, direction, options);

    // Debug: log node positions
    console.log("=== Node Positions ===");
    console.log(`Algorithm: ${options.algorithm}, PostAdjust: ${options.postLayoutAdjust.enabled ? `upper=${options.postLayoutAdjust.upperOffset}, lower=${options.postLayoutAdjust.lowerOffset}` : 'disabled'}`);
    layoutedNodes.forEach(node => {
      const partition = (node.data as any)?.ui?.partition ?? 0;
      console.log(`${node.id}: x=${Math.round(node.position.x)}, y=${Math.round(node.position.y)}, partition=${partition}, kind=${(node.data as any)?.kind}`);
    });
    console.log("======================");

    setNodes(layoutedNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges, layoutDirection, layoutOptions]);

  // Load graph on mount or demo change
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "renderGraph":
          loadGraph(message.graph);
          break;

        case "updateSelection":
          // Only update selection if we have a valid pointer AND graph
          // Don't clear selection if data is missing - this prevents race conditions
          // where navigation triggers a selection change that clears the panel
          if (message.jsonPointer && graph) {
            const node = findNodeForPointer(graph.nodes, message.jsonPointer);
            if (node) {
              setSelectedNodeId(node.id);
              setSelectedNode(node);
            }
            // If no matching node found, keep current selection
          }
          // Intentionally don't clear selection if jsonPointer is null
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify extension or load demo
    if (vscode) {
      vscode.postMessage({ type: "webviewReady" });
    } else {
      // Development mode: load selected demo graph
      loadGraph(demoGraphs[selectedDemo]);
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [selectedDemo, loadGraph]);

  // Re-apply layout after component is fully ready (fixes initial load issues)
  useEffect(() => {
    if (isReady && graph) {
      // Force re-layout after mount to ensure React Flow is fully initialized
      loadGraph(graph, layoutDirection);
    }
  }, [isReady]);

  // Handle node click - select node and show details panel
  // Navigation is now explicit via "Go to code" button in details panel
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    // Build IgmNode from node.data (already has all the info we need)
    const igmNode: IgmNode = {
      id: node.id,
      kind: node.data.kind as IgmNode["kind"],
      label: node.data.label as string,
      source: node.data.source as IgmNode["source"],
      step: node.data.step as IgmNode["step"],
      ui: node.data.ui as IgmNode["ui"],
      inputSchema: node.data.inputSchema as IgmNode["inputSchema"],
      outputSchema: node.data.outputSchema as IgmNode["outputSchema"],
    };

    setSelectedNodeId(node.id);
    setSelectedNode(igmNode);
  }, []);

  // Navigate to source code - called from details panel "Go to code" button
  const handleNavigateToSource = useCallback((node: IgmNode) => {
    if (!vscode) return;

    vscode.postMessage({
      type: "navigateToSource",
      jsonPointer: node.source?.jsonPointer ?? "/",
      uuid: node.step?.uuid,
    });
  }, []);

  // Handle close details panel
  const handleCloseDetails = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNode(null);
  }, []);

  // Handle open called recipe - drill-down to another recipe
  const handleOpenCalledRecipe = useCallback((zipName: string, recipeName?: string) => {
    if (!vscode) return;
    vscode.postMessage({
      type: "openCalledRecipe",
      zipName,
      recipeName,
    });
  }, []);

  // Handle layout direction change
  const toggleLayoutDirection = useCallback(() => {
    const newDirection = layoutDirection === "horizontal" ? "vertical" : "horizontal";
    setLayoutDirection(newDirection);
    if (graph) {
      loadGraph(graph, newDirection, layoutOptions);
    }
  }, [layoutDirection, graph, loadGraph, layoutOptions]);

  // Debug state - all debug-related state and callbacks are encapsulated in this hook
  // Only used in development mode
  const debugState = useDebugState({
    graph,
    nodes,
    selectedDemo,
    layoutDirection,
    loadGraph,
  });

  // Sync layout options from debug state when changed
  useEffect(() => {
    setLayoutOptions(debugState.layoutOptions);
  }, [debugState.layoutOptions]);

  // Ref for export functionality
  const flowRef = useRef<HTMLDivElement>(null);

  // Export as PNG
  const exportAsPng = useCallback(() => {
    if (!flowRef.current) return;
    const viewport = flowRef.current.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewport) return;

    toPng(viewport, {
      backgroundColor: "#ffffff",
      filter: (node) => {
        // Exclude controls and minimap from export
        const classList = node.classList;
        if (!classList) return true;
        return !classList.contains("react-flow__controls") && !classList.contains("react-flow__minimap");
      },
    }).then((dataUrl) => {
      const link = document.createElement("a");
      link.download = `${graph?.meta?.name ?? "recipe"}.png`;
      link.href = dataUrl;
      link.click();
    });
  }, [graph?.meta?.name]);

  // Export as SVG
  const exportAsSvg = useCallback(() => {
    if (!flowRef.current) return;
    const viewport = flowRef.current.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewport) return;

    toSvg(viewport, {
      backgroundColor: "#ffffff",
      filter: (node) => {
        const classList = node.classList;
        if (!classList) return true;
        return !classList.contains("react-flow__controls") && !classList.contains("react-flow__minimap");
      },
    }).then((dataUrl) => {
      const link = document.createElement("a");
      link.download = `${graph?.meta?.name ?? "recipe"}.svg`;
      link.href = dataUrl;
      link.click();
    });
  }, [graph?.meta?.name]);

  // Destructure debug state for easier access
  const { debugMode, setDebugMode, showPartitionOverlay, setShowPartitionOverlay, swimLaneBounds } = debugState;

  return (
    <div ref={flowRef} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes.map((n) => {
          const partition = (n.data as any)?.ui?.partition ?? 0;
          return {
            ...n,
            selected: n.id === selectedNodeId,
            // Add partition indicator to className for CSS styling (only in debug mode)
            className: debugMode && showPartitionOverlay ? `partition-${partition}` : undefined,
          };
        })}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
      >
        {/* Swim lane background overlay when debug mode enabled */}
        {debugMode && showPartitionOverlay && swimLaneBounds && (
          <SwimLaneOverlay swimLaneBounds={swimLaneBounds} />
        )}

        <Controls
          style={{
            backgroundColor: "var(--vscode-editor-background)",
            borderColor: "var(--vscode-panel-border)",
          }}
        />

        {/* Debug tools - only shown in development mode */}
        {import.meta.env.DEV && (
          <>
            <DebugToggleButton
              debugMode={debugMode}
              setDebugMode={setDebugMode}
              showPartitionOverlay={showPartitionOverlay}
              setShowPartitionOverlay={setShowPartitionOverlay}
            />
            {debugMode && (
              <DebugPanel
                nodes={nodes}
                layoutDirection={layoutDirection}
                debugState={debugState}
              />
            )}
          </>
        )}
        <MiniMap
          style={{
            backgroundColor: "var(--vscode-editor-background)",
            border: "1px solid var(--vscode-panel-border)",
          }}
          nodeColor={(node) => {
            switch (node.data?.kind) {
              case "trigger": return "#3b82f6";
              case "action": return "#22c55e";
              case "if": return "#6b7280";
              case "try": return "#6b7280";
              case "catch": return "#ef4444";
              case "foreach": return "#8b5cf6";
              case "error": return "#ef4444";
              default: return "#6b7280";
            }
          }}
          maskColor="rgba(0, 0, 0, 0.5)"
          pannable
          zoomable
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="var(--vscode-editor-lineHighlightBorder)"
        />
        <SearchBar
          graph={graph}
          onSelectNode={(node) => {
            setSelectedNodeId(node.id);
            setSelectedNode(node);
          }}
        />
      </ReactFlow>

      {/* Recipe info header */}
      {graph?.meta && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "8px 12px",
            backgroundColor: "var(--vscode-editor-background)",
            border: "1px solid var(--vscode-panel-border)",
            borderRadius: 4,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <strong>{graph.meta.name}</strong>
            <span style={{ opacity: 0.7, marginLeft: 8 }}>v{graph.meta.version}</span>
            <span style={{ opacity: 0.5, marginLeft: 8 }}>
              ({graph.nodes.length} nodes, {graph.edges.length} edges)
            </span>
          </div>
          <button
            onClick={toggleLayoutDirection}
            style={{
              padding: "4px 8px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-border, transparent)",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title={`Switch to ${layoutDirection === "horizontal" ? "vertical" : "horizontal"} layout`}
          >
            {layoutDirection === "horizontal" ? (
              <>
                <span style={{ transform: "rotate(90deg)", display: "inline-block" }}>&#10132;</span>
                <span>L-R</span>
              </>
            ) : (
              <>
                <span>&#10132;</span>
                <span>T-B</span>
              </>
            )}
          </button>
          <div style={{ width: 1, height: 16, backgroundColor: "var(--vscode-panel-border)" }} />
          <button
            onClick={exportAsPng}
            style={{
              padding: "4px 8px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-border, transparent)",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 11,
            }}
            title="Export as PNG"
          >
            PNG
          </button>
          <button
            onClick={exportAsSvg}
            style={{
              padding: "4px 8px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-border, transparent)",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 11,
            }}
            title="Export as SVG"
          >
            SVG
          </button>
        </div>
      )}

      {/* Demo selector (dev mode only) */}
      {!vscode && !selectedNode && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "8px 12px",
            backgroundColor: "var(--vscode-editor-background)",
            border: "1px solid var(--vscode-panel-border)",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          <label>
            Demo:{" "}
            <select
              value={selectedDemo}
              onChange={(e) => setSelectedDemo(e.target.value)}
              style={{
                backgroundColor: "var(--vscode-input-background)",
                color: "var(--vscode-input-foreground)",
                border: "1px solid var(--vscode-input-border)",
                borderRadius: 3,
                padding: "2px 4px",
              }}
            >
              {Object.keys(demoGraphs).map((key) => {
                const name = demoGraphs[key].meta?.name ?? key;
                const isDuplicate = Object.entries(demoGraphs).some(
                  ([k, g]) => k !== key && (g.meta?.name ?? k) === name
                );
                return (
                  <option key={key} value={key}>
                    {isDuplicate ? `${name} (${key})` : name}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      )}

      {/* Node details panel */}
      <NodeDetailsPanel
        node={selectedNode}
        onClose={handleCloseDetails}
        onNavigateToSource={handleNavigateToSource}
        onOpenCalledRecipe={handleOpenCalledRecipe}
      />
    </div>
  );
}
