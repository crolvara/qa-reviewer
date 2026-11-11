# QA Reviewer: call-summary review

A review surface that helps a QA reviewer decide whether a collections call summary accurately represents its transcript, and whether it needs correcting.

**Live app:** https://qa-reviewer-psi.vercel.app/ · No login, no access instructions needed.

## How to use it

1. Pick a call from the queue on the left. Each call shows its open flags by severity.
2. Read the **summary** (centre). Problem phrases are highlighted by severity; click one to see the finding and jump to the evidence turns in the transcript.
3. In the **findings** panel (right), **Confirm** or **Reject** each suggested finding, or add your own with evidence turns.
4. Set a **verdict**: Accurate, Minor issues or Needs correction. Optionally write a corrected summary (or start from the AI suggestion) and a note.
5. **Export CSV / JSON** to hand the results on.

Keys: `J`/`K` next/previous call, `1`/`2`/`3` verdict, `Esc` clear selection.

## Run locally

```bash
npm ci
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Node 20+. No environment variables, no database, no API keys.

## What I prioritised and why

- **The reviewer's decision, not automation.** The brief asks to distinguish acceptable summarisation from a meaningful loss or change. That is a judgement call, so every automated finding is a suggestion the reviewer confirms or rejects.
- **Evidence first.** Every finding cites call ID + turn IDs and highlights both the summary phrase and the transcript turns, so a reviewer can verify in seconds instead of re-reading the call.
- **Severity by risk of misleading a colleague.** Critical = wrong money, date, direction, promise, authority or vulnerability. Major = rule or compliance breach, meaningful omission. Minor = style.
- **Definite vs uncertain**, as the data readme asks, shown on every finding.
- **Two independent detection layers:**
  - *AI pre-review*: 4 parallel AI agents reviewed all 20 calls against `summary-rules.txt` and the data readme, producing typed findings with exact quotes, turn citations and a corrected summary.
  - *Deterministic rule checks* (`src/lib/checks.ts`): narrow, exact checks (arrears amount, payment amount, call direction, required phrases, sentence count, US spelling). When both agree, the finding shows **Rule-confirmed**.
- **Simple, robust delivery.** Static Next.js app, no backend or secrets, so nothing can break or leak at deploy.

## Material assumptions

- The transcript is the only source of truth; no external records.
- The data readme's conventions apply (e.g. "no DPA stated with agent" is required when verification is absent; named advice bodies are retained).
- One reviewer, no login. Decisions are stored in the browser (localStorage) and exported as CSV/JSON.
- AI findings are generated once during the session and shipped as static data, not called live. In production this would be a pipeline step.
- A missing category is only an omission when it was discussed and the rules require it.
- UI in British English.

## What I checked

- **AI findings, mechanically:** all 20 calls covered; every quote is an exact substring of its summary; every cited turn exists; enums valid.
- **AI findings, by hand:** all 30 read against their cited turns. **29 of 30 valid.** One false positive (CALL-007 flags "Payment made", which is the phrase the rules require). It is left unedited on purpose; the reviewer rejects it in the UI. Details: [docs/ai-verification.md](docs/ai-verification.md).
- **Rule checks:** run on all 20 calls, 6 hits, all true positives, all matching AI findings; none on the accurate calls. A loose keyword check produced false positives and was removed.
- **App:** strict TypeScript, lint and production build pass. Several review passes fixed: duplicate findings, corrupt-storage crash, CSV formula injection and Excel encoding (BOM), form state leaking between calls, shortcuts ignoring filters and Caps Lock, mobile horizontal overflow (verified at 319/375/768px).

## Summary of results (AI pre-review, before human decisions)

4 summaries accurate (004, 005, 006, 007 after rejecting the false positive). The rest contain issues such as: invented or changed promises to pay (002, 020), "Payment made" when nothing was taken (013), consent recorded when it was refused (003), Authority to Act wrong (012, 018), wrong call direction (019), invented default notice (008), wrong hold length (017), forbidden arrears/payment amounts (003, 016), missing required phrases (011, 015, 019, 020).

## Known limitations

- Decisions live in one browser; another reviewer or device starts empty. Open tabs sync via the storage event, but simultaneous edits to the same call are last-write-wins.
- CSP allows `'unsafe-inline'` scripts because Next.js's prerendered bootstrap is inline; nonces would force per-request rendering of a static app. No third-party origins are allowed and no user HTML is rendered.
- No audit trail of who decided what.
- AI findings are static for this dataset (finding IDs are content hashes, so saved decisions survive reordering).
- Overlapping highlights in the summary show only the first; all findings remain in the list.
- Tab and verdict groups lack arrow-key navigation.

## What I would tackle next

1. Shared storage (Postgres + Prisma) with reviewer login and an immutable audit log.
2. Live AI pre-review as a pipeline step on new calls, with stable finding IDs and measured precision/recall against reviewer decisions.
3. Feedback loop: rejected findings tune prompts and rules; aggregate error types per summary rule to fix the generator, not just the summaries.
4. Second-reviewer sampling and agreement metrics.

## Repository layout

| Path | Purpose |
|---|---|
| `src/components/` | UI: `ReviewApp` (layout, queue, verdict), `CallView` (summary + transcript), `FindingsPanel` |
| `src/lib/` | `data.ts` (parsing, merge), `checks.ts` (rule checks), `review-store.ts` (storage, CSV export) |
| `src/data/` | `calls.json` (supplied data), `ai-findings.json` (AI pre-review) |
| `ai-review/` | Raw AI output per batch, kept for provenance |
| `data summary/` | Original exercise inputs, unmodified |
| `docs/` | Changelog, patterns, AI verification log |
| `AGENTS.md` | Generated by Next.js 16 for AI coding agents |
