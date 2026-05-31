# Project Context

This is a Node.js/Express backend project (see `server.js`, `src/`, `prisma/`).

## Available Skills

When the user describes a problem or task, automatically pick and apply the right skill without asking:

| Trigger | Skill to use |
|--------|--------------|
| Bug, broken, error, crash, not working, 401, 500 | `/diagnose` |
| Build feature, add endpoint, implement, TDD | `/tdd` |
| Design UI, explore flow, wireframe, prototype | `/prototype` |
| Issue, report, request, ticket, triage | `/triage` |

> Do not ask the user which skill to use — infer it from context and proceed.

## Skills Location

All skills are in `.claude/skills/`. Read the relevant `SKILL.md` and follow it strictly.

## Project Stack

- Runtime: Node.js
- Framework: Express
- ORM: Prisma
- Tests: Jest (`jest.config.js`)
- Deploy: Vercel (`vercel.json`)

## Karpathy Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

### 1. Think Before Coding

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Remove imports/variables/functions that YOUR changes made unused only.
- Don't remove pre-existing dead code unless asked.

### 4. Goal-Driven Execution

Transform tasks into verifiable goals:
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Add validation" → "Write tests for invalid inputs, then make them pass"

For multi-step tasks, state a brief plan with verify steps before starting.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues on Thanh36-jqk/Project3. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one CONTEXT.md + docs/adr/ at repo root. See `docs/agents/domain.md`.
