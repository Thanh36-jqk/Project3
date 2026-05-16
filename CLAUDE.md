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

## Agent skills

### Issue tracker

Issues live in GitHub Issues on Thanh36-jqk/Project3. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout — CONTEXT-MAP.md at root points to per-context CONTEXT.md files. See `docs/agents/domain.md`.
