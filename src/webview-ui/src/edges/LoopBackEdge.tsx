import React from "react";
import { EdgeProps } from "@xyflow/react";

/**
 * Custom edge for loop-back edges that routes around the bottom/right of nodes
 * with smooth rounded corners instead of cutting through the graph
 */
export function LoopBackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  label,
  labelStyle,
  labelBgStyle,
  labelBgBorderRadius,
}: EdgeProps) {
  // Determine layout direction from positions
  // In horizontal layout, source is to the right of target (loop goes left)
  // In vertical layout, source is below target (loop goes up)
  const isHorizontal = Math.abs(targetX - sourceX) > Math.abs(targetY - sourceY);

  // Offset for the loop-back curve (how far outside the nodes to route)
  const loopOffset = 50;
  // Radius for rounded corners
  const cornerRadius = 12;

  let path: string;
  let labelX: number;
  let labelY: number;

  // Extract stroke color for the arrow marker
  const strokeColor = (style?.stroke as string) ?? "#8b5cf6";

  if (isHorizontal) {
    // Horizontal layout (L-R): loop goes below
    // Source is to the right of target, so path: down → left → up
    const midY = Math.max(sourceY, targetY) + loopOffset;

    // Use quadratic bezier curves for smooth corners
    path = `
      M ${sourceX} ${sourceY}
      L ${sourceX} ${midY - cornerRadius}
      Q ${sourceX} ${midY} ${sourceX - cornerRadius} ${midY}
      L ${targetX + cornerRadius} ${midY}
      Q ${targetX} ${midY} ${targetX} ${midY - cornerRadius}
      L ${targetX} ${targetY}
    `;

    labelX = (sourceX + targetX) / 2;
    labelY = midY;
  } else {
    // Vertical layout (T-B): loop goes to the right
    // Source is below target, so path: right → up → left
    const midX = Math.max(sourceX, targetX) + loopOffset;

    path = `
      M ${sourceX} ${sourceY}
      L ${midX - cornerRadius} ${sourceY}
      Q ${midX} ${sourceY} ${midX} ${sourceY - cornerRadius}
      L ${midX} ${targetY + cornerRadius}
      Q ${midX} ${targetY} ${midX - cornerRadius} ${targetY}
      L ${targetX} ${targetY}
    `;

    labelX = midX;
    labelY = (sourceY + targetY) / 2;
  }

  // Unique marker ID for this edge
  const markerId = `loopback-arrow-${id}`;

  return (
    <>
      {/* Arrow marker definition */}
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 L 3 5 Z"
            fill={strokeColor}
          />
        </marker>
      </defs>

      {/* The edge path */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={path}
        fill="none"
        markerEnd={`url(#${markerId})`}
      />

      {/* Label with background */}
      {label && (
        <>
          {labelBgStyle && (
            <rect
              x={labelX - 22}
              y={labelY - 9}
              width={44}
              height={18}
              rx={labelBgBorderRadius ?? 3}
              style={labelBgStyle}
            />
          )}
          <text
            x={labelX}
            y={labelY}
            style={{
              ...labelStyle,
              dominantBaseline: "middle",
              textAnchor: "middle",
            }}
            className="react-flow__edge-text"
          >
            {label as string}
          </text>
        </>
      )}
    </>
  );
}
