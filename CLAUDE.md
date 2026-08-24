@AGENTS.md

---

## Project documentation hooks

- If `CONTEXT.md` exists in the repo root (or a `CONTEXT-MAP.md` pointing to per-area `CONTEXT.md` files), treat it as the **domain glossary**. Use its vocabulary in plans, PRDs, commit messages, and code review. Update it lazily when a grilling session resolves an ambiguity.
- If `docs/adr/` exists, ADRs are **binding decisions** — read them before suggesting architectural changes and create a new ADR for any decision that is hard to reverse, surprising without context, and the result of a real trade-off. See `docs/adr/ADR-FORMAT.md`.

---

## Karpathy Coding Workflow

### 1. Plan Mode First
- Non-trivial → plan mode + detailed spec up front. Kill ambiguity pre-code.
- Trivial → lightweight inline plan.

### 2. Verify Relentlessly
- Watch diffs like hawk. Check assumptions, edge cases, tradeoffs.
- Run tests, review diffs, verify correctness. Never blind-accept.

### 3. Keep It Simple
- No overengineering. No bloated abstractions. 100 lines > 1000.
- Clean dead code. Ask "is there a simpler way?"
- **Simplicity First**: minimal code, nothing speculative.
- **No Laziness**: root causes only. No temp fixes. Senior-dev bar.

### 4. Surgical Edits Only
- Change only what's necessary. No drive-by "improvements".
- Don't touch unrelated code/comments. Minimize churn + side effects.

### 5. Goal-Driven Execution
- Clear success criteria. Tests first, then make pass.
- Tools in the loop (browser MCP, etc). Iterate until goal met.

### 6. Parallelize with Subagents
- Offload research/exploration/analysis. Keep main context clean.
- One task per subagent. Merge results with judgment.

### Engineer Mindset
- **Tenacity**: agents never tire. Stamina = force multiplier.
- **Leverage**: imperative → declarative. Multiply output.
- **Atrophy risk**: reading ≠ writing code. Stay sharp intentionally.
- **Speedups ≠ Just Faster**: expand what's buildable, not just velocity.
- **Fun**: cut drudgery, focus creativity.
- **Slopacolypse (2026)**: brace for AI slop. Signal needs judgment.

> LLM agent capability (Claude/Codex) crossed coherence threshold ~Dec 2025. Phase shift in SWE. Intelligence ahead — integrations/workflows must catch up.

---

## Core Principles

1. **Concise, Scalable Code**: Keep files focused and maintainable
2. **Type Safety**: Leverage TypeScript for robust code
3. **Simplicity**: Prefer clarity over cleverness

---

## File Organization

### Maximum File Size
- **Soft limit**: 400 lines per file
- If a file approaches this limit, split it into smaller, focused components
- Exceptions: Type definitions and configuration files may exceed this limit if necessary

### When to Split Components

Split a component when:
- It exceeds 350 lines (before hitting the 400-line limit)
- It handles multiple distinct responsibilities
- A section of code could be reused elsewhere
- It improves readability and maintainability


**Example splits:**
- Extract form sections into separate components
- Create dedicated display/card components for complex UI blocks
- Separate business logic into custom hooks
- Extract repeated patterns into shared components


## TypeScript

### Type Safety
- Always define types for props, state, and function parameters
- Avoid `any` - use `unknown` if type is truly unknown
- Leverage type inference where it improves readability
  
### Shared Types
- Define shared types in `src/types/index.ts`
- Use consistent naming across the codebase
- Export types for reuse

## Error and Loading Handling

### Robust Error and Loading States
- **Always apply robust error and loading handling on all APIs and components**
- Use proper loading states during async operations
- Provide meaningful error messages to users
- Implement proper error boundaries where needed
- Log errors for debugging purposes

---

## Communication mode

**Default for all conversation**, every phase (brainstorm, audit, spec,
plan, execution, review, PR): invoke `caveman:caveman` skill (level
`full`) at session start.

The skill auto-excludes: code blocks, commit messages, PR/spec/notes
docs, security warnings, irreversible-action confirmations, multi-step
sequences where fragment order risks misread. Those stay in full
language. Everything else — status updates, recommendations, decisions,
explanations — gets the terseness pass.

If skill not installed, ask the user once to enable plugin `caveman`
(marketplace `caveman` → `JuliusBrussee/caveman`). Continue without it
if user declines.

Override: user says "stop caveman" or "normal mode".

---

## Implementation Notes (mandatory during plan execution)

When implementing a spec or plan (whether triggered by `/implement`, by an
approved ExitPlanMode, or manually), keep a running notes file at:

```
docs/implementation-notes/<slug>-<YYYY-MM-DD>.md
```

The slug should mirror the spec/plan name when one exists.

**Create it before writing the first line of implementation code** and
update it incrementally — not in one dump at the end.

### What to record (only things not derivable from the diff or the spec)

- **Decisions outside the spec** — choices the spec did not pin down,
  with the alternative rejected and why
- **Deviations from the spec** — anything changed vs. what was written,
  with the reason
- **Tradeoffs** — perf vs. simplicity, scope cuts, "good enough for
  now". Name the cost
- **Gotchas / surprises** — undocumented framework behavior, hidden
  coupling, schema quirks
- **Deferred / follow-ups** — items punted to a later PR, linked
- **Open questions** — things the user should weigh in on at review

### What NOT to record

- Play-by-play of files touched or functions written (the diff shows it)
- Commit SHAs, line counts, file counts
- Anything already in the spec
- Empty "N/A" sections — delete the section instead

Bar: *"would a future maintainer be confused without this note?"* If no,
do not write it.

### At end of implementation

Surface the notes file with a one-line summary of the most important
entries — do not just point at the path.

### Skeleton

```markdown
# Implementation notes — <feature>

- **Spec**: <path or "n/a">
- **Plan**: <path or "n/a">
- **Started**: <YYYY-MM-DD>

## Decisions made outside the spec
- …

## Deviations from the spec
- …

## Tradeoffs
- …

## Gotchas / surprises
- …

## Deferred / follow-ups
- …

## Open questions for review
- …
```
