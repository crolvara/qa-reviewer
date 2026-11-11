# AI pre-review verification

How the AI findings in `src/data/ai-findings.json` were produced and checked.

## How they were produced

- 4 parallel AI agents, 5 calls each, given `summary-rules.txt`, `candidate-readme.md` and the calls.
- Each finding has a type (contradicted, unsupported, omission, rule_breach), severity, certainty, an exact summary quote and transcript turn IDs.
- Raw output is in `ai-review/batch-1..4.json`, merged into `src/data/ai-findings.json`.

## Automated integrity checks (all pass)

- 20 of 20 calls covered, 30 findings.
- Every `summaryQuote` is an exact substring of its summary (curly apostrophes included).
- Every cited turn ID exists in that call's transcript.
- Only valid enum values. Every non-accurate call has a corrected summary.
- No quote appears twice in a summary or overlaps another quote.

## Manual verification against the transcripts

All 30 findings were read against their cited turns.

| Result | Calls |
|---|---|
| Confirmed | 001, 002, 003, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020 |
| Correctly rated accurate | 004, 005, 006 |
| False positive | 007 |

**CALL-007 false positive:** the AI flagged "Payment made" (capital P after a semicolon) and the sentence order. "Payment made." is the exact phrase the rules require, and the order follows the rules' prescribed structure. CALL-007 is accurate. The AI file is left unedited on purpose: the reviewer rejects the finding in the UI.

**Judgement calls (correctly marked uncertain):** CALL-001 (£240 instalment equals the arrears figure), CALL-009 (£300 vs "about £300"), CALL-018 (hours reduction detail).

Precision on manual check: 29 of 30 findings valid.

## Cross-check with deterministic rules

Exact-pattern checks (arrears amount, payment amount, call direction, consent phrase, signposting, risk of further action) agreed with the AI on every hit. A loose keyword check for "hold" produced 3 false positives ("household" etc.) and was dropped.
