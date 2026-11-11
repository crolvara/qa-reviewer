# Changelog

Completed tasks, newest first. Format:

```
## YYYY-MM-DD - Short task title
- What was done
- Files changed
- Decisions, caveats or follow-ups
```

## 2026-11-11 - Phase 1: scaffold, data and AI pre-review
- Scaffolded Next.js 16 + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) + Tailwind 4 at repo root.
- Copied `candidate-calls.json` to `src/data/calls.json`; original `data summary/` untouched.
- AI pre-review of all 20 calls by 4 parallel agents, merged into `src/data/ai-findings.json` and verified (see `ai-verification.md`).
- Replaced template README with project README skeleton.
- Fix: first `npm install` hung and left truncated packages (`@next/swc-win32-x64-msvc` 2 MB instead of 110 MB, `language-subtag-registry` JSON cut off). Resolved with a clean `npm ci`. Lint and build pass.
- Decisions: no database (static data + localStorage + export). AI findings are advisory and need human accept/reject. CALL-007 AI finding is a known false positive, kept unedited.
- Follow-up: `@emnapi/runtime` and `@img/sharp-wasm32` show as extraneous in `npm ls`; harmless WASM fallbacks pinned in the lockfile.

## 2026-11-11 - Project setup
- Created `CLAUDE.md` with roles: software engineer, web designer, QA tester, security expert.
- Created `docs/` with `README.md`, `patterns.md` and `changelog.md`.
