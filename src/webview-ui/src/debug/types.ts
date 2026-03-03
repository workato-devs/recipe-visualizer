import { LayoutOptions, LayoutDirection } from "../useLayout";

/**
 * Snapshot of layout state for debugging and analysis
 */
export interface LayoutSnapshot {
  id: string;
  name: string;
  timestamp: number;
  fixture: string;
  options: LayoutOptions;
  direction: LayoutDirection;
  nodes: Array<{
    id: string;
    kind: string;
    partition: number;
    x: number;
    y: number;
  }>;
  feedback: string;
}

/**
 * Props for swim lane bounds calculation
 */
export interface SwimLaneBounds {
  byPartition: Record<number, { minY: number; maxY: number; minX: number; maxX: number }>;
  overall: { minX: number; maxX: number; minY: number; maxY: number };
  direction: LayoutDirection;
}
