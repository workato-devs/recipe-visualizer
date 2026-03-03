import ELK, { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import { Node, Edge } from "@xyflow/react";

const elk = new ELK();

// Helper to get kind from node data
function getKind(node: Node): string | undefined {
  return (node.data as { kind?: string })?.kind;
}

// Helper to get partition from node data
function getPartition(node: Node): number {
  const ui = (node.data as { ui?: { partition?: number } })?.ui;
  return ui?.partition ?? 0;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;

// ============================================================================
// Standardized Node Sizes - Two tiers for consistent layout
// ============================================================================

// Tier 1: "Main" nodes - actions, triggers, terminals (prominent)
const MAIN_NODE_HEIGHT = 70;
const MAIN_NODE_MIN_WIDTH = 220;

// Tier 2: "Control" nodes - if, try, catch, branch, foreach, end (small pills)
const CONTROL_NODE_HEIGHT = 30;
const CONTROL_NODE_WIDTH = 60;

// Consistent padding between nodes
const NODE_PADDING = 20; // Extra buffer around all nodes

export type LayoutDirection = "horizontal" | "vertical";

// ============================================================================
// Layout Options - Configurable via debug panel
// ============================================================================

export type LayoutAlgorithm = "layered" | "stress" | "force" | "mrtree";

export interface PostLayoutAdjust {
  enabled: boolean;
  /** Y offset for partition 1 (upper/success path), typically negative */
  upperOffset: number;
  /** Y offset for partition 2 (lower/error path), typically positive */
  lowerOffset: number;
}

export interface LayoutOptions {
  algorithm: LayoutAlgorithm;
  postLayoutAdjust: PostLayoutAdjust;
  /** Enable ELK's built-in partitioning (assigns partition to ELK nodes) */
  elkPartitioning: boolean;
  /** Two-pass layout: re-sort Y positions by partition within each layer */
  twoPassYSort: boolean;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  algorithm: "mrtree",
  postLayoutAdjust: {
    enabled: true,
    upperOffset: -80,
    lowerOffset: 80,
  },
  elkPartitioning: false,
  twoPassYSort: false,
};

/**
 * Check if an edge is a loop-back edge (goes from body back to foreach node)
 * These edges cause ELK to create figure-8 patterns
 */
function isLoopBackEdge(edge: Edge, nodes: Node[]): boolean {
  if (!edge.id.startsWith("loop|")) return false;
  const targetNode = nodes.find(n => n.id === edge.target);
  return targetNode ? getKind(targetNode) === "foreach" : false;
}

/**
 * Get ELK algorithm name from our enum
 */
function getElkAlgorithm(algorithm: LayoutAlgorithm): string {
  switch (algorithm) {
    case "layered": return "layered";
    case "stress": return "stress";
    case "force": return "force";
    case "mrtree": return "mrtree";
    default: return "layered";
  }
}

/**
 * Apply ELK layout to nodes with partition-based swim lanes
 */
export async function applyLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "horizontal",
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS
): Promise<Node[]> {
  if (nodes.length === 0) return [];

  const elkDirection = direction === "horizontal" ? "RIGHT" : "DOWN";
  const elkAlgorithm = getElkAlgorithm(options.algorithm);

  // Build ELK nodes - optionally with partition info for ELK partitioning
  const elkNodes: ElkNode[] = nodes.map((node) => {
    const elkNode: ElkNode = {
      id: node.id,
      width: getNodeWidth(node),
      height: getNodeHeight(node),
    };

    // Option 2: Add partition info for ELK's built-in partitioning
    if (options.elkPartitioning) {
      const partition = getPartition(node);
      elkNode.layoutOptions = {
        "elk.partitioning.partition": String(partition),
      };
    }

    return elkNode;
  });

  // Filter out loop-back edges
  const forwardEdges = edges.filter(edge => !isLoopBackEdge(edge, nodes));

  const elkEdges: ElkExtendedEdge[] = forwardEdges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  // Base layout options with consistent padding
  const layoutOptions: Record<string, string> = {
    "elk.algorithm": elkAlgorithm,
    "elk.direction": elkDirection,
    // Consistent spacing between all nodes
    "elk.spacing.nodeNode": "60",
    // Padding around the entire graph
    "elk.padding": "[top=30,left=30,bottom=50,right=30]",
  };

  // Enable ELK partitioning if requested
  if (options.elkPartitioning) {
    layoutOptions["elk.partitioning.activate"] = "true";
  }

  // Algorithm-specific options with improved spacing
  if (elkAlgorithm === "layered") {
    Object.assign(layoutOptions, {
      // Space between layers (columns in horizontal, rows in vertical)
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      // Space between edges and nodes
      "elk.layered.spacing.edgeNodeBetweenLayers": "30",
      // Edge routing style
      "elk.edgeRouting": "ORTHOGONAL",
      // Node placement strategy - NETWORK_SIMPLEX often gives better results
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      // Crossing minimization
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      // Compaction
      "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
      "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
      // Consider node labels for spacing
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    });
  } else if (elkAlgorithm === "stress") {
    Object.assign(layoutOptions, {
      "elk.stress.desiredEdgeLength": "120",
    });
  } else if (elkAlgorithm === "force") {
    Object.assign(layoutOptions, {
      "elk.force.iterations": "300",
    });
  } else if (elkAlgorithm === "mrtree") {
    Object.assign(layoutOptions, {
      // MrTree specific - tighter spacing since it's already compact
      "elk.spacing.nodeNode": "50",
      // Consistent spacing between tree levels
      "elk.mrtree.spacing.nodeNode": "50",
    });
  }

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  // Run ELK layout
  const layoutedGraph = await elk.layout(elkGraph);

  // Apply positions to nodes
  const nodePositions = new Map<string, { x: number; y: number }>();
  layoutedGraph.children?.forEach((elkNode) => {
    nodePositions.set(elkNode.id, {
      x: elkNode.x ?? 0,
      y: elkNode.y ?? 0,
    });
  });

  // Option 3: Two-pass sort - re-sort nodes by partition within each layer
  // Direction-aware: horizontal sorts Y within X layers, vertical sorts X within Y layers
  if (options.twoPassYSort) {
    applyTwoPassSort(nodes, nodePositions, direction);
  }

  // Fix ::end node placement - move it to the logical end of the graph
  fixEndNodePlacement(nodes, nodePositions, direction);

  // Apply post-layout adjustment based on partitions
  // Direction-aware: horizontal adjusts Y, vertical adjusts X
  const { postLayoutAdjust } = options;

  return nodes.map((node) => {
    const pos = nodePositions.get(node.id) ?? { x: 0, y: 0 };
    let adjustedX = pos.x;
    let adjustedY = pos.y;

    if (postLayoutAdjust.enabled) {
      const partition = getPartition(node);

      if (direction === "horizontal") {
        // Horizontal layout: partitions separate on Y axis
        // P1 (upper/success) moves up (negative Y), P2 (lower/error) moves down (positive Y)
        if (partition === 1) {
          adjustedY += postLayoutAdjust.upperOffset;
        } else if (partition === 2) {
          adjustedY += postLayoutAdjust.lowerOffset;
        }
      } else {
        // Vertical layout: partitions separate on X axis
        // P1 (left/success) moves left (negative X), P2 (right/error) moves right (positive X)
        if (partition === 1) {
          adjustedX += postLayoutAdjust.upperOffset;
        } else if (partition === 2) {
          adjustedX += postLayoutAdjust.lowerOffset;
        }
      }
    }

    return {
      ...node,
      position: { x: adjustedX, y: adjustedY },
    };
  });
}

/**
 * Two-pass sort: Group nodes by layer, then re-sort positions within each layer
 * so that partition 1 is always before partition 0, which is before partition 2.
 *
 * Direction-aware:
 * - Horizontal: Group by X (layers are columns), sort Y within each layer (P1 top, P2 bottom)
 * - Vertical: Group by Y (layers are rows), sort X within each layer (P1 left, P2 right)
 */
function applyTwoPassSort(
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>,
  direction: LayoutDirection
): void {
  const layerTolerance = 50; // Nodes within 50px are considered same layer
  const layers: Map<number, Node[]> = new Map();

  // Group nodes into layers based on primary axis
  const getPrimaryAxis = (pos: { x: number; y: number }) =>
    direction === "horizontal" ? pos.x : pos.y;
  const getSecondaryAxis = (pos: { x: number; y: number }) =>
    direction === "horizontal" ? pos.y : pos.x;

  nodes.forEach(node => {
    const pos = positions.get(node.id);
    if (!pos) return;

    const primaryPos = getPrimaryAxis(pos);

    // Find existing layer or create new one
    let foundLayer = false;
    for (const [layerPos, layerNodes] of layers) {
      if (Math.abs(primaryPos - layerPos) <= layerTolerance) {
        layerNodes.push(node);
        foundLayer = true;
        break;
      }
    }
    if (!foundLayer) {
      layers.set(primaryPos, [node]);
    }
  });

  // For each layer, sort nodes by partition and redistribute secondary axis positions
  for (const [_, layerNodes] of layers) {
    if (layerNodes.length <= 1) continue;

    // Get current positions and sizes
    const nodeData = layerNodes.map(node => {
      const pos = positions.get(node.id)!;
      const size = direction === "horizontal" ? getNodeHeight(node) : getNodeWidth(node);
      return {
        node,
        partition: getPartition(node),
        secondaryPos: getSecondaryAxis(pos),
        size,
      };
    });

    // Sort by partition (1 first, then 0, then 2)
    nodeData.sort((a, b) => {
      const partitionOrder = (p: number) => p === 1 ? 0 : p === 0 ? 1 : 2;
      return partitionOrder(a.partition) - partitionOrder(b.partition);
    });

    // Calculate the range used by this layer on secondary axis
    const minSecondary = Math.min(...nodeData.map(d => d.secondaryPos));
    const maxSecondary = Math.max(...nodeData.map(d => d.secondaryPos + d.size));
    const totalRange = maxSecondary - minSecondary;

    // Redistribute positions while maintaining relative spacing
    const totalNodeSize = nodeData.reduce((sum, d) => sum + d.size, 0);
    const spacing = Math.max(20, (totalRange - totalNodeSize) / Math.max(1, nodeData.length - 1));

    let currentPos = minSecondary;
    nodeData.forEach((data) => {
      const pos = positions.get(data.node.id)!;
      if (direction === "horizontal") {
        pos.y = currentPos;
      } else {
        pos.x = currentPos;
      }
      currentPos += data.size + spacing;
    });
  }
}

/**
 * Fix ::end node placement - ensure it's at the logical end of the graph
 * For horizontal layouts: rightmost position
 * For vertical layouts: bottommost position
 */
function fixEndNodePlacement(
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>,
  direction: LayoutDirection
): void {
  // Find the end node
  const endNode = nodes.find(n => n.id === "::end" || getKind(n) === "end");
  if (!endNode) return;

  const endPos = positions.get(endNode.id);
  if (!endPos) return;

  // Calculate the max position of all other nodes
  let maxPrimary = -Infinity;
  let avgSecondary = 0;
  let count = 0;

  nodes.forEach(node => {
    if (node.id === endNode.id) return;
    const pos = positions.get(node.id);
    if (!pos) return;

    const nodeWidth = getNodeWidth(node);
    const nodeHeight = getNodeHeight(node);

    if (direction === "horizontal") {
      // For horizontal: find rightmost edge (x + width)
      maxPrimary = Math.max(maxPrimary, pos.x + nodeWidth);
      avgSecondary += pos.y;
    } else {
      // For vertical: find bottommost edge (y + height)
      maxPrimary = Math.max(maxPrimary, pos.y + nodeHeight);
      avgSecondary += pos.x;
    }
    count++;
  });

  if (count === 0) return;
  avgSecondary /= count;

  // Position end node at the max + padding, centered on secondary axis
  const padding = 100;
  const endWidth = getNodeWidth(endNode);
  const endHeight = getNodeHeight(endNode);

  if (direction === "horizontal") {
    endPos.x = maxPrimary + padding;
    // Keep Y near the center/average of partition 0 nodes, or use current Y if reasonable
    // Find average Y of partition 0 nodes for better centering
    let p0AvgY = 0;
    let p0Count = 0;
    nodes.forEach(node => {
      if (node.id === endNode.id) return;
      if (getPartition(node) === 0) {
        const pos = positions.get(node.id);
        if (pos) {
          p0AvgY += pos.y;
          p0Count++;
        }
      }
    });
    if (p0Count > 0) {
      endPos.y = p0AvgY / p0Count;
    }
  } else {
    endPos.y = maxPrimary + padding;
    // Center X on partition 0 nodes
    let p0AvgX = 0;
    let p0Count = 0;
    nodes.forEach(node => {
      if (node.id === endNode.id) return;
      if (getPartition(node) === 0) {
        const pos = positions.get(node.id);
        if (pos) {
          p0AvgX += pos.x;
          p0Count++;
        }
      }
    });
    if (p0Count > 0) {
      endPos.x = p0AvgX / p0Count;
    }
  }
}

/**
 * Get node width based on type - standardized into two tiers
 * Includes NODE_PADDING buffer for cleaner edge routing
 */
function getNodeWidth(node: Node): number {
  const kind = getKind(node);

  // Tier 1: Main nodes (actions, triggers, terminals)
  if (kind === "trigger" || kind === "action") {
    return MAIN_NODE_MIN_WIDTH + NODE_PADDING;
  }

  // Tier 2: Control nodes (all small pills)
  if (kind === "if" || kind === "try" || kind === "catch" ||
      kind === "foreach" || kind === "branch" || kind === "join" || kind === "end") {
    return CONTROL_NODE_WIDTH + NODE_PADDING;
  }

  return NODE_WIDTH + NODE_PADDING;
}

/**
 * Get node height based on type - standardized into two tiers
 * All nodes in same tier have identical height for clean horizontal alignment
 */
function getNodeHeight(node: Node): number {
  const kind = getKind(node);

  // Tier 1: Main nodes - all same height for alignment
  if (kind === "trigger" || kind === "action") {
    return MAIN_NODE_HEIGHT;
  }

  // Tier 2: Control nodes - all same height for alignment
  if (kind === "if" || kind === "try" || kind === "catch" ||
      kind === "foreach" || kind === "branch" || kind === "join" || kind === "end") {
    return CONTROL_NODE_HEIGHT;
  }

  return NODE_HEIGHT;
}
