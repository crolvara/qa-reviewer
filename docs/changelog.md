# Changelog

Completed tasks, newest first. Format:

```
## YYYY-MM-DD - Short task title
- What was done
- Files changed
- Decisions, caveats or follow-ups
```

## 2026-11-11 - Replace native confirm() popups with in-app dialog
- Reset and "Start from AI suggested correction" used `window.confirm()`, which shows an unstyled browser popup with the site URL. Replaced with a styled modal (`useConfirm()` hook on native `<dialog>.showModal()`).
- Destructive dialogs use a red confirm button and focus Cancel first. Esc and backdrop click cancel. Focus returns to the trigger.
- J/K/1/2/3 shortcuts are now ignored while a dialog is open, so keys cannot change a verdict behind the modal.
- Verified in Edge headless (Playwright): dialog opens, Esc/backdrop cancel, "2" ignored while open, confirm clears reviews, no native dialog fired, fits at 320px.
- Files: `src/components/ConfirmDialog.tsx` (new), `src/components/ReviewApp.tsx`.

## 2026-11-11 - Fixes from independent review (correctness, security, a11y)
- Verdict tied to findings: confirmed/rejected/pending counts, warnings for contradictions (Accurate with confirmed findings, verdict without support, Needs correction without corrected summary). Click no longer silently clears a verdict; explicit "Clear verdict".
- Dedupe: rule finding merges into an AI finding only when the AI title is about the same rule (`matchKey`) and quote/turns overlap. Verified: one turn with signposting + MoneyHelper now yields both findings; real data unchanged (6 Rule-confirmed).
- Storage: field-by-field validation of saved data (no crash on corrupt storage), sync between tabs via `storage` event, "not saved" banner on write failure.
- CSV guard also catches leading whitespace, newline and full-width `＝＋－＠`.
- J/K navigate relative to the full list (works after the call leaves a filter); key repeat ignored.
- Turn IDs normalised ("T5", "5" -> "T05"). Voicemail summaries exempt from sentence count; "1 sentence" wording. "Unclear speaker" no longer auto-labelled as hallucination.
- Security headers: X-Frame-Options DENY, frame-ancestors 'none', nosniff, no-referrer, Permissions-Policy, noindex.
- A11y: highlight buttons announce severity and finding; finding cards expose `aria-expanded`.
- Follow-up, same day: content-hash finding IDs (FNV-1a, 30/30 unique), rule IDs from title; keyboard shortcuts toggle (WCAG 2.1.4, remembered per browser); selected finding card scrolls into view (respects reduced motion); AI verdict collapsed by default against anchoring bias; full static CSP (`default-src 'self'`, no nonces by design). Verified on local `next start`: headers present, 16/16 browser checks, 0 console errors.

## 2026-11-11 - Fix colour contrast (Lighthouse / WCAG AA)
- Small grey text `text-slate-500` / `text-slate-400` failed 4.5:1 on `indigo-50` and `slate-100` backgrounds. All changed to `text-slate-600`.
- Suspected-hallucination transcript turns (`opacity-60`) and rejected findings (`opacity-55`) faded text to ~2.9:1. Replaced opacity with a tinted, dashed treatment; badge and strike-through still mark the state.
- Verified with axe-core `color-contrast` in Edge headless: all 20 calls at 375px and 1440px, with a finding rejected and a verdict set. 0 violations.
- Files: `src/components/ReviewApp.tsx`, `src/components/FindingsPanel.tsx`, `src/components/CallView.tsx`.

## 2026-11-11 - Phase 2: review surface and README
- Built queue, summary highlighting, transcript with evidence turns, findings confirm/reject, own findings, verdict, correction, CSV/JSON export, keyboard shortcuts.
- Rule checks in `src/lib/checks.ts`; duplicates of AI findings shown as "Rule-confirmed".
- Review passes fixed: duplicate findings, corrupt storage crash, CSV BOM + formula guard, download revoke timing, invalid turn IDs, form state leaking across calls, J/K ignoring filter and Caps Lock, AI correction overwriting text.
- Files: `src/lib/*`, `src/components/*`, `src/app/*`, `README.md`.

## 2026-11-11 - Fix mobile horizontal overflow
- Bug: at 319px the page was wider than the screen and cut off on the left. The header controls row could not wrap, and the root flex item plus `grid-cols-1` grew to fit it.
- Fix: header controls wrap (progress on its own row on phones, buttons below), root gets `w-full min-w-0`, grid tracks use `minmax(0,1fr)`, transcript rows use `minmax(0,1fr)` + `break-words`.
- Verified in Edge headless at 319/375/768px: `scrollWidth === clientWidth`.
- Files: `src/components/ReviewApp.tsx`, `src/components/CallView.tsx`.

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
