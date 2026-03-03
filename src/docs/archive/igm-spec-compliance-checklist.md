# IGM vs Extension Spec: Compliance Checklist

Legend: Covered | Partial | Gap | Out-of-scope (explicit)

| Spec requirement | Status | Notes | References |
|---|---|---|---|
| Offline-first, local parsing | Partial | Implied by design, not stated explicitly in IGM doc | `docs/igm-spec.md` |
| Deterministic IDs | Covered | UUID or JSON Pointer fallback | `docs/igm-spec.md` |
| JSON Pointer source mapping | Covered | SourceRef with pointer + optional range | `docs/igm-spec.md` |
| Control-flow mapping (if/try/catch) | Covered | Full rules and join creation | `docs/igm-spec.md` |
| Terminal/end handling | Covered | ::end + terminal edges + dangling cleanup | `docs/igm-spec.md` |
| Data-flow edges (optional) | Covered | Datapill parsing rules + diagnostics | `docs/igm-spec.md` |
| Array collection + prototype semantics | Gap | Not present in base IGM | `docs/archive/specs/igm-spec-v2-addendum.md` |
| Array expansion/virtualization | Gap | Not present in base IGM | `docs/archive/specs/igm-spec-v2-addendum.md` |
| Collapsible groups/subgraphs | Gap | No group model in base IGM | `docs/archive/specs/igm-spec-v2-addendum.md` |
| Diagnostics for heterogeneous arrays | Gap | Not present in base IGM | `docs/archive/specs/igm-spec-v2-addendum.md` |
| Loop constructs | Out-of-scope | Explicitly deferred to v2 | `docs/igm-spec.md` |
| Renderer choice rationale | Gap | Not addressed in IGM | `workflow-json-visualizer-extension-spec-notes.md` |
| UX interactions (search/focus/minimap) | Gap | Only non-normative hints | `docs/igm-spec.md` |
| Webview CSP + typed protocol | Gap | Not in IGM | `docs/archive/security/webview-csp-message-protocol-baseline.md` |
| Dependency minimization | Gap | Not in IGM | `workflow-json-visualizer-extension-spec-notes.md` |
| Fixture coverage | Partial | Examples listed, not codified | `docs/igm-spec.md` |
