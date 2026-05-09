import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { NodeUi, StepMeta, SourceRef } from "../../../shared/types";

export type LayoutDirection = "horizontal" | "vertical";

interface NodeData {
  label: string;
  kind: string;
  ui?: NodeUi;
  step?: StepMeta;
  source?: SourceRef;
  layoutDirection?: LayoutDirection;
}

interface CustomNodeProps {
  data: NodeData;
  selected?: boolean;
}

// Get handle positions based on layout direction
function getSourcePosition(direction?: LayoutDirection): Position {
  return direction === "vertical" ? Position.Bottom : Position.Right;
}

function getTargetPosition(direction?: LayoutDirection): Position {
  return direction === "vertical" ? Position.Top : Position.Left;
}

// Common handle styles
const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#6b7280",
  border: "2px solid var(--vscode-editor-background, #1e1e1e)",
};

const smallHandleStyle: React.CSSProperties = {
  ...handleStyle,
  width: 6,
  height: 6,
};

// Step number badge component
const StepNumberBadge = ({ number }: { number?: number }) => {
  if (number === undefined) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: -8,
        left: -8,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#475569",
        border: "2px solid var(--vscode-editor-background, #1e1e1e)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        color: "#e2e8f0",
        fontFamily: "var(--vscode-editor-font-family, monospace)",
      }}
    >
      {number}
    </div>
  );
};

// ============================================================================
// TRIGGER NODE - Entry point, prominent but not overwhelming
// ============================================================================
export const TriggerNode = memo(({ data, selected }: CustomNodeProps) => (
  <div
    style={{
      position: "relative",
      padding: "12px 16px",
      borderRadius: 8,
      border: `2px solid ${selected ? "#60a5fa" : "#3b82f6"}`,
      background: "linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)",
      minWidth: 160,
      boxShadow: selected
        ? "0 0 0 2px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(59, 130, 246, 0.2)"
        : "0 2px 8px rgba(59, 130, 246, 0.15), 0 2px 4px rgba(0,0,0,0.2)",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    }}
  >
    <StepNumberBadge number={data.step?.number} />
    <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={{ ...handleStyle, opacity: 0 }} />
    <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.5px" }}>
      {data.ui?.triggerType?.replace("_", " ") ?? "Trigger"}
    </div>
    <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 13 }}>{data.label}</div>
    <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={handleStyle} />
  </div>
));
TriggerNode.displayName = "TriggerNode";

// ============================================================================
// ACTION NODE - The star of the show! Large, prominent, info-rich
// ============================================================================
export const ActionNode = memo(({ data, selected }: CustomNodeProps) => {
  const isRecipeCall = data.ui?.isRecipeCall;

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 16px",
        borderRadius: 8,
        border: `2px solid ${selected ? "#3b82f6" : isRecipeCall ? "#22c55e" : "#475569"}`,
        background: isRecipeCall
          ? "linear-gradient(135deg, #1a2e1a 0%, #1e293b 100%)"
          : "#1e293b",
        minWidth: 200,
        boxShadow: selected
          ? "0 0 0 2px rgba(59, 130, 246, 0.3)"
          : isRecipeCall
            ? "0 2px 8px rgba(34, 197, 94, 0.15), 0 2px 4px rgba(0,0,0,0.2)"
            : "0 2px 4px rgba(0,0,0,0.2)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <StepNumberBadge number={data.step?.number} />
      <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={handleStyle} />

      {/* Provider badge */}
      {data.ui?.badge && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#22c55e",
            textTransform: "uppercase",
            marginBottom: 4,
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isRecipeCall && <span style={{ fontSize: 12 }}>↗</span>}
          {data.ui.badge}
        </div>
      )}

      {/* Action name - the main label */}
      <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 14 }}>
        {data.label}
      </div>

      {/* Step name if different from label */}
      {data.step?.name && data.step.name !== data.label && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          {data.step.name}
        </div>
      )}

      {/* Recipe call indicator */}
      {isRecipeCall && data.ui?.recipeCallRef?.name && (
        <div style={{
          fontSize: 10,
          color: "#86efac",
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          → {data.ui.recipeCallRef.name}
        </div>
      )}

      <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={handleStyle} />
    </div>
  );
});
ActionNode.displayName = "ActionNode";

// ============================================================================
// TERMINAL NODE - Return/response, shows HTTP status prominently
// ============================================================================

const STOP_ERROR_COLOR = "#ef4444";
const STOP_GRACEFUL_COLOR = "#64748b";

function getStopStyle(ui?: NodeUi): { color: string; badgeLabel: string } | null {
  if (ui?.stopWithError !== undefined) {
    return ui.stopWithError
      ? { color: STOP_ERROR_COLOR, badgeLabel: "ERROR" }
      : { color: STOP_GRACEFUL_COLOR, badgeLabel: "STOP" };
  }
  return null;
}

export const TerminalNode = memo(({ data, selected }: CustomNodeProps) => {
  const stopStyle = getStopStyle(data.ui);
  const borderColor = stopStyle ? stopStyle.color : getStatusColor(data.ui?.httpStatus);

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 16px",
        borderRadius: 8,
        border: `3px solid ${selected ? "#3b82f6" : borderColor}`,
        background: "#1e293b",
        minWidth: 180,
        boxShadow: selected
          ? "0 0 0 2px rgba(59, 130, 246, 0.3)"
          : `0 2px 8px ${borderColor}26, 0 2px 4px rgba(0,0,0,0.2)`,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <StepNumberBadge number={data.step?.number} />
      <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={handleStyle} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* HTTP status badge (non-stop terminals) */}
        {!stopStyle && data.ui?.httpStatus && (
          <div
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              background: borderColor,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--vscode-editor-font-family, monospace)",
            }}
          >
            {data.ui.httpStatus}
          </div>
        )}

        {/* Stop badge */}
        {stopStyle && (
          <div
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              background: stopStyle.color,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              letterSpacing: "0.5px",
            }}
          >
            {stopStyle.badgeLabel}
          </div>
        )}

        <div>
          <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 13 }}>
            {data.label}
          </div>
          {data.ui?.badge && (
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{data.ui.badge}</div>
          )}
        </div>
      </div>

      {/* Stop reason */}
      {data.ui?.stopReason && (
        <div style={{
          fontSize: 11,
          color: "#94a3b8",
          marginTop: 6,
          fontStyle: "italic",
          lineHeight: 1.3,
        }}>
          {data.ui.stopReason}
        </div>
      )}

      <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={handleStyle} />
    </div>
  );
});
TerminalNode.displayName = "TerminalNode";

// ============================================================================
// CONTROL NODES - Small, subtle, don't steal focus from actions
// ============================================================================

// Try node - small pill
export const ControlNode = memo(({ data, selected }: CustomNodeProps) => {
  const isTry = data.kind === "try";

  return (
    <div
      style={{
        position: "relative",
        padding: "6px 14px",
        borderRadius: 16,
        border: `2px solid ${selected ? "#3b82f6" : isTry ? "#6b7280" : "#6b7280"}`,
        background: "#374151",
        fontSize: 11,
        fontWeight: 600,
        color: "#d1d5db",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <StepNumberBadge number={data.step?.number} />
      <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={smallHandleStyle} />
      {isTry ? "try" : "if"}
      <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={smallHandleStyle} />
    </div>
  );
});
ControlNode.displayName = "ControlNode";

// Catch node - small pill with error color hint
export const CatchNode = memo(({ data, selected }: CustomNodeProps) => (
  <div
    style={{
      position: "relative",
      padding: "6px 14px",
      borderRadius: 16,
      border: `2px solid ${selected ? "#3b82f6" : "#ef4444"}`,
      background: "#374151",
      fontSize: 11,
      fontWeight: 600,
      color: "#fca5a5",
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}
  >
    <StepNumberBadge number={data.step?.number} />
    <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={{ ...smallHandleStyle, background: "#ef4444" }} />
    catch
    <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={smallHandleStyle} />
  </div>
));
CatchNode.displayName = "CatchNode";

// Branch node (Then/Else) - tiny pills
export const BranchNode = memo(({ data, selected }: CustomNodeProps) => {
  const isElse = data.label === "Else";

  return (
    <div
      style={{
        position: "relative",
        padding: "3px 10px",
        borderRadius: 10,
        border: `1px solid ${selected ? "#3b82f6" : isElse ? "#ef4444" : "#22c55e"}`,
        background: isElse ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
        fontSize: 10,
        fontWeight: 600,
        color: isElse ? "#fca5a5" : "#86efac",
      }}
    >
      <StepNumberBadge number={data.step?.number} />
      <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={{ ...smallHandleStyle, width: 5, height: 5 }} />
      {data.label}
      <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={{ ...smallHandleStyle, width: 5, height: 5 }} />
    </div>
  );
});
BranchNode.displayName = "BranchNode";

// Foreach node - loop control with distinctive styling
export const ForeachNode = memo(({ data, selected }: CustomNodeProps) => (
  <div
    style={{
      position: "relative",
      padding: "6px 14px",
      borderRadius: 16,
      border: `2px solid ${selected ? "#3b82f6" : "#8b5cf6"}`,
      background: "#374151",
      fontSize: 11,
      fontWeight: 600,
      color: "#c4b5fd",
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}
  >
    <StepNumberBadge number={data.step?.number} />
    <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={{ ...smallHandleStyle, background: "#8b5cf6" }} />
    <span style={{ fontSize: 10 }}>↻</span>
    foreach
    <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={{ ...smallHandleStyle, background: "#8b5cf6" }} />
  </div>
));
ForeachNode.displayName = "ForeachNode";

// End node - small pill like try/catch
export const EndNode = memo(({ data, selected }: CustomNodeProps) => (
  <div
    style={{
      padding: "6px 14px",
      borderRadius: 16,
      border: `2px solid ${selected ? "#3b82f6" : "#6b7280"}`,
      background: "#374151",
      fontSize: 11,
      fontWeight: 600,
      color: "#d1d5db",
      display: "flex",
      alignItems: "center",
    }}
  >
    <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={smallHandleStyle} />
    end
  </div>
));
EndNode.displayName = "EndNode";

// Error node - red warning indicator
export const ErrorNode = memo(({ data, selected }: CustomNodeProps) => (
  <div
    style={{
      padding: "10px 14px",
      borderRadius: 8,
      border: `2px solid ${selected ? "#3b82f6" : "#ef4444"}`,
      background: "rgba(239, 68, 68, 0.15)",
      minWidth: 140,
      boxShadow: selected ? "0 0 0 2px rgba(59, 130, 246, 0.3)" : "0 2px 4px rgba(0,0,0,0.2)",
    }}
  >
    <Handle type="target" position={getTargetPosition(data.layoutDirection)} style={{ ...smallHandleStyle, background: "#ef4444" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 14 }}>⚠</span>
      <div>
        <div style={{ fontWeight: 600, color: "#fca5a5", fontSize: 12 }}>
          {data.label}
        </div>
        {data.ui?.badge && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 2 }}>
            {data.ui.badge}
          </div>
        )}
      </div>
    </div>
    <Handle type="source" position={getSourcePosition(data.layoutDirection)} style={{ ...smallHandleStyle, background: "#ef4444" }} />
  </div>
));
ErrorNode.displayName = "ErrorNode";

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status?: string): string {
  if (!status) return "#6b7280";
  const code = parseInt(status, 10);
  if (code >= 200 && code < 300) return "#22c55e"; // Green
  if (code >= 300 && code < 400) return "#3b82f6"; // Blue
  if (code >= 400 && code < 500) return "#f97316"; // Orange
  if (code >= 500) return "#ef4444"; // Red
  return "#6b7280";
}

// Export node types map for React Flow
export const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  terminalNode: TerminalNode,
  controlNode: ControlNode,
  catchNode: CatchNode,
  errorNode: ErrorNode,
  foreachNode: ForeachNode,
  branchNode: BranchNode,
  endNode: EndNode,
};
