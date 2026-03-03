# Webview CSP + Message Protocol Baseline

This is a minimal baseline to satisfy the extension spec's security and messaging requirements. It is intentionally conservative and dependency-light.

---

## 1) Webview CSP (must-have)

Use a strict CSP with nonces:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  img-src ${webview.cspSource} data: blob:;
  style-src ${webview.cspSource} 'nonce-${nonce}';
  script-src ${webview.cspSource} 'nonce-${nonce}';
  font-src ${webview.cspSource};
  connect-src 'none';
">
```

Rules:
- No remote scripts, no remote styles.
- All assets loaded via `asWebviewUri`.
- Avoid inline scripts/styles unless using a nonce.

---

## 2) Message protocol (typed, versioned)

### 2.1 Envelope
```ts
type ProtocolMessage = {
  type: string;
  requestId?: string;
  protocolVersion: "1";
  payload?: unknown;
};
```

### 2.2 Extension -> Webview
```ts
type ExtToWebview =
  | { type: "renderIgm"; protocolVersion: "1"; payload: IgmGraph }
  | { type: "renderIgmDiff"; protocolVersion: "1"; payload: IgmDiff }
  | { type: "selectNode"; protocolVersion: "1"; payload: { nodeId: string } }
  | { type: "setConfig"; protocolVersion: "1"; payload: { collapsePolicy: CollapsePolicy } }
  | { type: "showDiagnostics"; protocolVersion: "1"; payload: Diagnostic[] };
```

### 2.3 Webview -> Extension
```ts
type WebviewToExt =
  | { type: "nodeSelected"; protocolVersion: "1"; payload: { nodeId: string } }
  | { type: "requestReveal"; protocolVersion: "1"; payload: { jsonPointer: string } }
  | { type: "toggleGroup"; protocolVersion: "1"; payload: { groupId: string } }
  | { type: "expandArray"; protocolVersion: "1"; payload: { nodeId: string; count: number } }
  | { type: "search"; protocolVersion: "1"; payload: { query: string } };
```

### 2.4 Validation
- Validate `protocolVersion` and `type` before handling.
- Validate payload shape (lightweight manual checks or a small schema helper).
- Drop unknown message types by default.

---

## 3) Webview security posture (must-have)

- Never use `innerHTML` for labels; use `textContent` to avoid injection.
- Do not execute untrusted content from the JSON in scripts.
- Avoid runtime `eval` and `new Function`.
- No outbound network calls (`connect-src 'none'`).

---

## 4) State and storage

- Store expand/collapse state in extension host state (workspace scope).
- Treat webview as a pure view; all authoritative state lives in extension host.

---

## 5) Minimal diagnostics channel

- Extension sends diagnostics in `showDiagnostics`.
- Webview renders a non-blocking panel or badge; no modal alerts.

---

## 6) Non-normative notes

- Prefer a single message entrypoint with a typed router.
- Consider diff-based updates only after correctness is stable.
