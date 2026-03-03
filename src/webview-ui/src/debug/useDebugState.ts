import { useState, useCallback, useMemo } from "react";
import { Node } from "@xyflow/react";
import {
  LayoutOptions,
  LayoutDirection,
  PostLayoutAdjust,
  DEFAULT_LAYOUT_OPTIONS,
} from "../useLayout";
import { IgmGraph } from "../../../shared/types";
import { LayoutSnapshot, SwimLaneBounds } from "./types";

export interface UseDebugStateProps {
  graph: IgmGraph | null;
  nodes: Node[];
  selectedDemo: string;
  layoutDirection: LayoutDirection;
  loadGraph: (g: IgmGraph, direction: LayoutDirection, options: LayoutOptions) => Promise<void>;
}

export interface UseDebugStateReturn {
  // Debug mode toggle
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;

  // Layout options
  layoutOptions: LayoutOptions;
  livePreview: boolean;
  setLivePreview: (enabled: boolean) => void;
  updateLayoutOptions: (updates: Partial<LayoutOptions>) => void;
  updatePostLayoutAdjust: (updates: Partial<PostLayoutAdjust>) => void;
  applyLayoutManually: () => void;

  // Snapshots
  snapshots: LayoutSnapshot[];
  snapshotName: string;
  setSnapshotName: (name: string) => void;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  createSnapshot: () => void;
  exportSnapshot: (snapshot: LayoutSnapshot) => void;
  exportCurrentState: () => void;
  deleteSnapshot: (id: string) => void;
  loadSnapshotSettings: (snapshot: LayoutSnapshot) => void;

  // Visualization
  showPartitionOverlay: boolean;
  setShowPartitionOverlay: (show: boolean) => void;
  swimLaneBounds: SwimLaneBounds | null;
  getPartitionStyle: (partition: number) => React.CSSProperties;
}

export function useDebugState({
  graph,
  nodes,
  selectedDemo,
  layoutDirection,
  loadGraph,
}: UseDebugStateProps): UseDebugStateReturn {
  // Core debug state
  const [debugMode, setDebugMode] = useState(false);
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>(DEFAULT_LAYOUT_OPTIONS);
  const [livePreview, setLivePreview] = useState(true);

  // Snapshot state
  const [snapshots, setSnapshots] = useState<LayoutSnapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [feedbackText, setFeedbackText] = useState("");

  // Visualization state
  const [showPartitionOverlay, setShowPartitionOverlay] = useState(true);

  // Handle layout options change
  const updateLayoutOptions = useCallback((updates: Partial<LayoutOptions>) => {
    const newOptions = { ...layoutOptions, ...updates };
    setLayoutOptions(newOptions);
    if (livePreview && graph) {
      loadGraph(graph, layoutDirection, newOptions);
    }
  }, [layoutOptions, livePreview, graph, loadGraph, layoutDirection]);

  // Handle post-layout adjust changes
  const updatePostLayoutAdjust = useCallback((updates: Partial<PostLayoutAdjust>) => {
    const newAdjust = { ...layoutOptions.postLayoutAdjust, ...updates };
    updateLayoutOptions({ postLayoutAdjust: newAdjust });
  }, [layoutOptions.postLayoutAdjust, updateLayoutOptions]);

  // Apply layout manually (when live preview is off)
  const applyLayoutManually = useCallback(() => {
    if (graph) {
      loadGraph(graph, layoutDirection, layoutOptions);
    }
  }, [graph, loadGraph, layoutDirection, layoutOptions]);

  // Create snapshot
  const createSnapshot = useCallback(() => {
    if (!graph) return;

    const snapshot: LayoutSnapshot = {
      id: `snap-${Date.now()}`,
      name: snapshotName || `Snapshot ${snapshots.length + 1}`,
      timestamp: Date.now(),
      fixture: selectedDemo,
      options: { ...layoutOptions },
      direction: layoutDirection,
      nodes: nodes.map(node => ({
        id: node.id,
        kind: (node.data as any)?.kind ?? "unknown",
        partition: (node.data as any)?.ui?.partition ?? 0,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      })),
      feedback: feedbackText,
    };

    setSnapshots(prev => [...prev, snapshot]);
    setSnapshotName("");
    setFeedbackText("");
  }, [graph, snapshotName, feedbackText, snapshots.length, selectedDemo, layoutOptions, layoutDirection, nodes]);

  // Export snapshot as JSON
  const exportSnapshot = useCallback((snapshot: LayoutSnapshot) => {
    const exportData = {
      fixture: snapshot.fixture,
      options: snapshot.options,
      direction: snapshot.direction,
      nodes: snapshot.nodes,
      feedback: snapshot.feedback,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json);
    console.log("Snapshot exported to clipboard:", json);
  }, []);

  // Export current state
  const exportCurrentState = useCallback(() => {
    if (!graph) return;

    const exportData = {
      fixture: selectedDemo,
      options: layoutOptions,
      direction: layoutDirection,
      nodes: nodes.map(node => ({
        id: node.id,
        kind: (node.data as any)?.kind ?? "unknown",
        partition: (node.data as any)?.ui?.partition ?? 0,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      })),
      feedback: feedbackText,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json);
    console.log("Current state exported to clipboard:", json);
  }, [graph, selectedDemo, layoutOptions, layoutDirection, nodes, feedbackText]);

  // Delete snapshot
  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  }, []);

  // Load snapshot settings
  const loadSnapshotSettings = useCallback((snapshot: LayoutSnapshot) => {
    setLayoutOptions(snapshot.options);
    if (graph) {
      loadGraph(graph, snapshot.direction, snapshot.options);
    }
  }, [graph, loadGraph]);

  // Compute swim lane bounds for visualization (direction-aware)
  const swimLaneBounds = useMemo((): SwimLaneBounds | null => {
    if (nodes.length === 0) return null;

    // Group nodes by partition
    const byPartition: Record<number, { minY: number; maxY: number; minX: number; maxX: number }> = {};

    nodes.forEach(node => {
      const partition = (node.data as any)?.ui?.partition ?? 0;
      const nodeHeight = 60; // Approximate
      const nodeWidth = 200; // Approximate

      if (!byPartition[partition]) {
        byPartition[partition] = {
          minY: node.position.y,
          maxY: node.position.y + nodeHeight,
          minX: node.position.x,
          maxX: node.position.x + nodeWidth,
        };
      } else {
        byPartition[partition].minY = Math.min(byPartition[partition].minY, node.position.y);
        byPartition[partition].maxY = Math.max(byPartition[partition].maxY, node.position.y + nodeHeight);
        byPartition[partition].minX = Math.min(byPartition[partition].minX, node.position.x);
        byPartition[partition].maxX = Math.max(byPartition[partition].maxX, node.position.x + nodeWidth);
      }
    });

    // Calculate overall bounds
    const allNodes = Object.values(byPartition);
    if (allNodes.length === 0) return null;

    const overall = {
      minX: Math.min(...allNodes.map(p => p.minX)) - 50,
      maxX: Math.max(...allNodes.map(p => p.maxX)) + 50,
      minY: Math.min(...allNodes.map(p => p.minY)) - 50,
      maxY: Math.max(...allNodes.map(p => p.maxY)) + 50,
    };

    return { byPartition, overall, direction: layoutDirection };
  }, [nodes, layoutDirection]);

  // Get partition glow style for nodes in debug mode
  const getPartitionStyle = useCallback((partition: number): React.CSSProperties => {
    if (!debugMode || !showPartitionOverlay) return {};
    switch (partition) {
      case 1: // Upper/success path - green glow
        return {
          boxShadow: "0 0 12px 4px rgba(34, 197, 94, 0.5)",
          borderColor: "#22c55e",
        };
      case 2: // Lower/error path - red glow
        return {
          boxShadow: "0 0 12px 4px rgba(239, 68, 68, 0.5)",
          borderColor: "#ef4444",
        };
      default: // Center/main axis - gray glow
        return {
          boxShadow: "0 0 8px 2px rgba(107, 114, 128, 0.3)",
        };
    }
  }, [debugMode, showPartitionOverlay]);

  return {
    debugMode,
    setDebugMode,
    layoutOptions,
    livePreview,
    setLivePreview,
    updateLayoutOptions,
    updatePostLayoutAdjust,
    applyLayoutManually,
    snapshots,
    snapshotName,
    setSnapshotName,
    feedbackText,
    setFeedbackText,
    createSnapshot,
    exportSnapshot,
    exportCurrentState,
    deleteSnapshot,
    loadSnapshotSettings,
    showPartitionOverlay,
    setShowPartitionOverlay,
    swimLaneBounds,
    getPartitionStyle,
  };
}
