# ADR Format

<!-- Adapted from github.com/mattpocock/skills (MIT) by Matt Pocock -->

Architecture Decision Records (ADRs) live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create `docs/adr/` lazily — only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: context, decision, why.}
```

An ADR can be a single paragraph. Value is in recording *that* a decision was made and *why* — not in filling out sections.

## Optional sections

Only when they add value:

- **Status** (`proposed | accepted | deprecated | superseded by ADR-NNNN`)
- **Considered Options** — when rejected alternatives matter
- **Consequences** — when non-obvious downstream effects exist

## Numbering

Scan `docs/adr/` for the highest existing number, increment by one.

## When to write an ADR

All three must be true:

1. **Hard to reverse** — meaningful cost to change later
2. **Surprising without context** — future reader will wonder "why this way?"
3. **Real trade-off** — genuine alternatives existed, you picked one for specific reasons

If easy to reverse → skip. If not surprising → nobody asks why. If no alternative → "we did the obvious thing" needs no record.

### Qualifying examples

- **Architectural shape.** Monorepo. Event-sourced write model + projected read model.
- **Integration patterns.** Domain events vs synchronous HTTP between contexts.
- **Technology lock-in.** DB, message bus, auth, deployment target.
- **Boundary decisions.** Who owns customer data. Explicit no-s.
- **Deliberate deviations.** "Manual SQL not ORM because X."
- **Invisible constraints.** Compliance bars certain providers. Partner SLA caps response time.
- **Rejected alternatives.** Considered GraphQL, picked REST for subtle reasons — otherwise someone re-proposes it in six months.
