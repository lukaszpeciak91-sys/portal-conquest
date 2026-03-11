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

## Documentation Update Rules (Strict)

### 1. `progress.md`
Use `progress.md` only for:
- current implementation status
- what systems are implemented
- what systems are stub / partial / missing
- current phase of the project

Do NOT put:
- design philosophy
- interaction design decisions
- technical audit summaries
- historical reasoning

### 2. `decisions.md`
Use `decisions.md` only for:
- active design decisions
- architecture decisions
- gameplay flow decisions
- UI / UX decisions that are intended to remain true
- rejected directions worth remembering

Examples:
- castle click opens build panel
- building click opens building-specific panel
- castle uses max 6 building slots
- castles use layered illustration system

Do NOT put:
- temporary implementation details
- raw diagnostic output
- current code status snapshots

### 3. `diagnostics.md`
Use `diagnostics.md` only for:
- diagnostic findings
- architectural investigations
- technical conclusions from diagnosis tasks
- discovered risks / mismatches / blockers

### Diagnostics storage rule
Diagnostic workflow must follow this rule:

- Full diagnostic analysis belongs in the Codex conversation.
- Repository documentation must contain only compressed conclusions.

`docs/project/diagnostics.md` should contain:
- short summary of the issue
- final technical conclusion
- implementation direction

Diagnostic reports must NOT include:
- full file inspection lists
- long architectural analysis
- step-by-step debugging logs

Purpose: keep repository documentation compact and readable.

Do NOT use `diagnostics.md` as an implementation changelog.

Only update it when:
- a diagnostic task is executed
- a new technical issue is discovered
- an audit result needs to be preserved

### 4. `workflow.md`
Use `workflow.md` only for:
- project workflow rules
- task templates
- documentation rules
- repository process rules

Do NOT use it for project progress or feature decisions.

### 5. General rule
When a task finishes, Codex must decide documentation updates like this:

- implementation state changed → update `progress.md`
- long-term design/architecture decision changed → update `decisions.md`
- diagnostic/audit produced important technical findings → update `diagnostics.md`
- workflow/process/documentation policy changed → update `workflow.md`

If none of the above applies, do not update docs unnecessarily.

### 6. Anti-chaos rule
Do NOT create new standalone documentation files unless explicitly requested.

Project knowledge must stay centralized in:
- `docs/project/workflow.md`
- `docs/project/progress.md`
- `docs/project/decisions.md`
- `docs/project/diagnostics.md`
- `docs/project/generation-prompts.md`

## Compression Rule
When `progress.md` or `decisions.md` grows too long or repetitive, compress it into a shorter authoritative summary that preserves:
1. Current truth,
2. Important decision history,
3. Rejected directions worth remembering.

Prefer concise, high-signal entries over exhaustive chronological logs.
