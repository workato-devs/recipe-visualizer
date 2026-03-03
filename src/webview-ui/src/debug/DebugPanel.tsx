import { Node } from "@xyflow/react";
import { LayoutAlgorithm, LayoutDirection } from "../useLayout";
import { SwimLaneBounds } from "./types";
import { UseDebugStateReturn } from "./useDebugState";

/**
 * Get color for node kind (debug display)
 */
function getKindColor(kind: string): string {
  switch (kind) {
    case "trigger": return "#3b82f6";
    case "action": return "#22c55e";
    case "if": case "try": return "#6b7280";
    case "catch": return "#ef4444";
    case "foreach": return "#8b5cf6";
    case "branch": return "#f59e0b";
    case "end": return "#6b7280";
    default: return "#9ca3af";
  }
}

interface DebugToggleButtonProps {
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  showPartitionOverlay: boolean;
  setShowPartitionOverlay: (show: boolean) => void;
}

export function DebugToggleButton({
  debugMode,
  setDebugMode,
  showPartitionOverlay,
  setShowPartitionOverlay,
}: DebugToggleButtonProps) {
  return (
    <div style={{
      position: "absolute",
      bottom: 10,
      right: 10,
      zIndex: 10,
      display: "flex",
      gap: 6,
    }}>
      {debugMode && (
        <button
          onClick={() => setShowPartitionOverlay(!showPartitionOverlay)}
          style={{
            padding: "6px 12px",
            background: showPartitionOverlay ? "#22c55e" : "#374151",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Toggle partition visualization"
        >
          Partitions
        </button>
      )}
      <button
        onClick={() => setDebugMode(!debugMode)}
        style={{
          padding: "6px 12px",
          background: debugMode ? "#f59e0b" : "#374151",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {debugMode ? "Debug ON" : "Debug OFF"}
      </button>
    </div>
  );
}

interface SwimLaneOverlayProps {
  swimLaneBounds: SwimLaneBounds;
}

export function SwimLaneOverlay({ swimLaneBounds }: SwimLaneOverlayProps) {
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {Object.entries(swimLaneBounds.byPartition).map(([partition, bounds]) => {
        const p = parseInt(partition);
        const color = p === 1 ? "rgba(34, 197, 94, 0.08)" : p === 2 ? "rgba(239, 68, 68, 0.08)" : "rgba(107, 114, 128, 0.05)";
        const borderColor = p === 1 ? "rgba(34, 197, 94, 0.3)" : p === 2 ? "rgba(239, 68, 68, 0.3)" : "rgba(107, 114, 128, 0.2)";
        const labelColor = p === 1 ? "#22c55e" : p === 2 ? "#ef4444" : "#6b7280";

        // Direction-aware labels and positioning
        const isHorizontal = swimLaneBounds.direction === "horizontal";
        const label = isHorizontal
          ? (p === 1 ? "Upper (Success/Then)" : p === 2 ? "Lower (Error/Else)" : "Center (Main)")
          : (p === 1 ? "Left (Success/Then)" : p === 2 ? "Right (Error/Else)" : "Center (Main)");

        // For horizontal: bands span X, separated on Y
        // For vertical: bands span Y, separated on X
        const rectProps = isHorizontal
          ? {
              x: swimLaneBounds.overall.minX,
              y: bounds.minY - 20,
              width: swimLaneBounds.overall.maxX - swimLaneBounds.overall.minX,
              height: bounds.maxY - bounds.minY + 40,
            }
          : {
              x: bounds.minX - 20,
              y: swimLaneBounds.overall.minY,
              width: bounds.maxX - bounds.minX + 40,
              height: swimLaneBounds.overall.maxY - swimLaneBounds.overall.minY,
            };

        const textProps = isHorizontal
          ? {
              x: swimLaneBounds.overall.minX + 10,
              y: bounds.minY - 5,
            }
          : {
              x: bounds.minX - 15,
              y: swimLaneBounds.overall.minY + 15,
              transform: `rotate(-90, ${bounds.minX - 15}, ${swimLaneBounds.overall.minY + 15})`,
            };

        return (
          <g key={partition}>
            <rect
              {...rectProps}
              fill={color}
              stroke={borderColor}
              strokeWidth={1}
              strokeDasharray="4 4"
              rx={8}
            />
            <text
              {...textProps}
              fill={labelColor}
              fontSize={10}
              fontWeight={600}
              fontFamily="system-ui"
            >
              P{partition}: {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface DebugPanelProps {
  nodes: Node[];
  layoutDirection: LayoutDirection;
  debugState: UseDebugStateReturn;
}

export function DebugPanel({ nodes, layoutDirection, debugState }: DebugPanelProps) {
  const {
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
  } = debugState;

  return (
    <div style={{
      position: "absolute",
      bottom: 50,
      right: 10,
      width: 340,
      maxHeight: "80vh",
      overflow: "auto",
      background: "rgba(0,0,0,0.92)",
      border: "1px solid #525252",
      borderRadius: 6,
      padding: 12,
      zIndex: 10,
      fontSize: 11,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Layout Controls Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "#f59e0b", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          Layout Controls
          <span style={{ fontSize: 9, color: "#6b7280", fontWeight: 400 }}>
            {livePreview ? "(live)" : "(manual)"}
          </span>
        </div>

        {/* Algorithm dropdown */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", color: "#9ca3af", marginBottom: 4, fontSize: 10 }}>Algorithm</label>
          <select
            value={layoutOptions.algorithm}
            onChange={(e) => updateLayoutOptions({ algorithm: e.target.value as LayoutAlgorithm })}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 4,
              color: "#e5e7eb",
              fontSize: 11,
            }}
          >
            <option value="layered">Layered (ELK default)</option>
            <option value="stress">Stress</option>
            <option value="force">Force</option>
            <option value="mrtree">MrTree</option>
          </select>
        </div>

        {/* Post-layout Y adjustment */}
        <div style={{ marginBottom: 10, padding: 10, background: "#111827", borderRadius: 4, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ color: "#9ca3af", fontSize: 10 }}>Post-Layout Y Adjustment</label>
            <input
              type="checkbox"
              checked={layoutOptions.postLayoutAdjust.enabled}
              onChange={(e) => updatePostLayoutAdjust({ enabled: e.target.checked })}
              style={{ cursor: "pointer" }}
            />
          </div>

          {layoutOptions.postLayoutAdjust.enabled && (
            <>
              {/* P1 offset slider - direction aware labels */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: "#22c55e", fontSize: 10 }}>
                    {layoutDirection === "horizontal" ? "Upper" : "Left"} (P1) Offset
                  </span>
                  <span style={{ color: "#e5e7eb", fontSize: 10, fontFamily: "monospace" }}>
                    {layoutOptions.postLayoutAdjust.upperOffset}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="0"
                  value={layoutOptions.postLayoutAdjust.upperOffset}
                  onChange={(e) => updatePostLayoutAdjust({ upperOffset: parseInt(e.target.value) })}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              </div>

              {/* P2 offset slider - direction aware labels */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: "#ef4444", fontSize: 10 }}>
                    {layoutDirection === "horizontal" ? "Lower" : "Right"} (P2) Offset
                  </span>
                  <span style={{ color: "#e5e7eb", fontSize: 10, fontFamily: "monospace" }}>
                    {layoutOptions.postLayoutAdjust.lowerOffset}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={layoutOptions.postLayoutAdjust.lowerOffset}
                  onChange={(e) => updatePostLayoutAdjust({ lowerOffset: parseInt(e.target.value) })}
                  style={{ width: "100%", cursor: "pointer" }}
                />
              </div>
            </>
          )}
        </div>

        {/* ELK Partitioning toggle (Option 2) */}
        <div style={{ marginBottom: 10, padding: 10, background: "#111827", borderRadius: 4, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label style={{ color: "#9ca3af", fontSize: 10, display: "block" }}>ELK Partitioning</label>
              <span style={{ color: "#6b7280", fontSize: 9 }}>Let ELK handle partition separation</span>
            </div>
            <input
              type="checkbox"
              checked={layoutOptions.elkPartitioning}
              onChange={(e) => updateLayoutOptions({ elkPartitioning: e.target.checked })}
              style={{ cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Two-Pass Y Sort toggle (Option 3) */}
        <div style={{ marginBottom: 10, padding: 10, background: "#111827", borderRadius: 4, border: "1px solid #1f2937" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label style={{ color: "#9ca3af", fontSize: 10, display: "block" }}>Two-Pass Y Sort</label>
              <span style={{ color: "#6b7280", fontSize: 9 }}>Re-sort Y by partition within layers</span>
            </div>
            <input
              type="checkbox"
              checked={layoutOptions.twoPassYSort}
              onChange={(e) => updateLayoutOptions({ twoPassYSort: e.target.checked })}
              style={{ cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Live preview toggle and apply button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={livePreview}
              onChange={(e) => setLivePreview(e.target.checked)}
            />
            Live Preview
          </label>
          {!livePreview && (
            <button
              onClick={applyLayoutManually}
              style={{
                padding: "4px 12px",
                background: "#3b82f6",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#374151", margin: "12px 0" }} />

      {/* Snapshot Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "#8b5cf6", fontSize: 12 }}>Snapshots</div>

        {/* Create snapshot */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Snapshot name..."
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 4,
              color: "#e5e7eb",
              fontSize: 11,
              marginBottom: 6,
            }}
          />
          <textarea
            placeholder="Feedback notes..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 4,
              color: "#e5e7eb",
              fontSize: 10,
              resize: "vertical",
              marginBottom: 6,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={createSnapshot}
              style={{
                flex: 1,
                padding: "6px 12px",
                background: "#8b5cf6",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Snapshot
            </button>
            <button
              onClick={exportCurrentState}
              style={{
                padding: "6px 12px",
                background: "#059669",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Export current state to clipboard"
            >
              Export
            </button>
          </div>
        </div>

        {/* Snapshot list */}
        {snapshots.length > 0 && (
          <div style={{ maxHeight: 150, overflow: "auto" }}>
            {snapshots.map(snap => (
              <div
                key={snap.id}
                style={{
                  padding: 8,
                  background: "#1f2937",
                  borderRadius: 4,
                  marginBottom: 4,
                  fontSize: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: "#e5e7eb", fontWeight: 600 }}>{snap.name}</span>
                  <span style={{ color: "#6b7280" }}>{snap.options.algorithm}</span>
                </div>
                {snap.feedback && (
                  <div style={{ color: "#9ca3af", marginBottom: 4, fontStyle: "italic" }}>
                    "{snap.feedback.slice(0, 50)}{snap.feedback.length > 50 ? "..." : ""}"
                  </div>
                )}
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => loadSnapshotSettings(snap)}
                    style={{
                      padding: "2px 8px",
                      background: "#374151",
                      border: "none",
                      borderRadius: 3,
                      color: "#e5e7eb",
                      fontSize: 9,
                      cursor: "pointer",
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => exportSnapshot(snap)}
                    style={{
                      padding: "2px 8px",
                      background: "#374151",
                      border: "none",
                      borderRadius: 3,
                      color: "#e5e7eb",
                      fontSize: 9,
                      cursor: "pointer",
                    }}
                  >
                    Export
                  </button>
                  <button
                    onClick={() => deleteSnapshot(snap.id)}
                    style={{
                      padding: "2px 8px",
                      background: "#7f1d1d",
                      border: "none",
                      borderRadius: 3,
                      color: "#fca5a5",
                      fontSize: 9,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#374151", margin: "12px 0" }} />

      {/* Node Positions Table */}
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8, color: "#f59e0b", fontSize: 12 }}>Node Positions</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace" }}>
          <thead>
            <tr style={{ color: "#9ca3af", borderBottom: "1px solid #525252" }}>
              <th style={{ textAlign: "left", padding: "2px 4px" }}>ID</th>
              <th style={{ textAlign: "right", padding: "2px 4px" }}>X</th>
              <th style={{ textAlign: "right", padding: "2px 4px" }}>Y</th>
              <th style={{ textAlign: "right", padding: "2px 4px" }}>P</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(node => {
              const partition = (node.data as any)?.ui?.partition ?? 0;
              const kind = (node.data as any)?.kind ?? "?";
              return (
                <tr key={node.id} style={{ color: "#e5e7eb" }}>
                  <td style={{ padding: "2px 4px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }} title={node.id}>
                    <span style={{ color: getKindColor(kind) }}>{kind.slice(0,3)}</span> {node.id.slice(0,12)}
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 4px" }}>{Math.round(node.position.x)}</td>
                  <td style={{ textAlign: "right", padding: "2px 4px" }}>{Math.round(node.position.y)}</td>
                  <td style={{ textAlign: "right", padding: "2px 4px", color: partition === 0 ? "#6b7280" : partition === 1 ? "#22c55e" : "#ef4444" }}>{partition}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
