# Project Workflow Source of Truth

## Core Rules
1. **Architecture before features.** Stabilize shared systems (state, routing, data/asset pipelines) before adding content-heavy gameplay features.
2. **Diagnose before implementing when state is uncertain.** If current system behavior or ownership is unclear, run a diagnostic task first.
3. **Do not duplicate existing architecture.** Extend current systems instead of creating parallel ones.
4. **Inspect repository state before structural proposals.** Confirm actual code and data status before suggesting refactors or major implementation steps.
5. **Use `SceneRouter` for scene transitions.** Avoid ad-hoc direct scene switching patterns.
6. **Use `GameState` + runtime state helpers for persistent run state.** Avoid scene-local permanent state stores.
7. **Use existing asset manifest/loader patterns.** Extend `asset-manifest.json` + shared loaders rather than inventing separate asset pipelines.

## Session Start Rule
Every new project session should start with this order:
1. Read `docs/project/workflow.md`.
2. Read `docs/project/progress.md`.
3. Read `docs/project/decisions.md`.
4. Verify current repository state before proposing or executing tasks.

## Task Templates

### Diagnostic Task Template
- **Title**
- **Repo name**
- **Branch name**
- **GOAL**
- **CONTEXT**
- **WHAT TO INSPECT**
- **REQUIRED OUTPUT**
- **ACCEPTANCE CRITERIA**

Rules for diagnostic tasks:
- Diagnostic tasks are read-only and **must not modify code, assets, scenes, or runtime systems**.
- Findings must distinguish between confirmed repo truth vs assumptions.
- Output should list blockers, risks, and recommended next tasks.

### Implementation Task Template
- **Title**
- **Repo name**
- **Branch name**
- **GOAL**
- **CONTEXT**
- **WHAT TO IMPLEMENT**
- **REQUIRED OUTPUT**
- **ACCEPTANCE CRITERIA**

Rules for implementation tasks:
- First verify current repository state for touched systems.
- Reuse established architecture (`SceneRouter`, `GameState`/runtime state, asset manifest/loader).
- Keep scope explicit; avoid hidden structural rewrites.
- Include validation checks/tests in output.

## Documentation Update Rules
- Update `docs/project/workflow.md` **only** when workflow or delivery pipeline rules change.
- Update `docs/project/progress.md` whenever implementation status changes.
- Update `docs/project/decisions.md` whenever active design or architecture decisions change.
- Record diagnostic task outputs in `docs/project/diagnostics.md` as compact summary entries (append/merge); avoid one-file-per-diagnostic docs unless explicitly requested.

## Compression Rule
When `progress.md` or `decisions.md` grows too long or repetitive, compress it into a shorter authoritative summary that preserves:
1. Current truth,
2. Important decision history,
3. Rejected directions worth remembering.

Prefer concise, high-signal entries over exhaustive chronological logs.
