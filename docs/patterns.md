# Patterns

Reusable patterns established in this project. Each entry: what it is, when to use it, and where it lives.

## Code

_None yet._

## Design / UX

_None yet._

## Testing / QA

- **Verify AI output mechanically, then by hand.** For AI-generated findings: script-check that every quote is an exact substring and every cited ID exists, then read each finding against its source. Record precision in `docs/ai-verification.md`. Never hand-edit AI output to hide errors; let the reviewer reject it in the UI.
- **Deterministic checks must be narrow.** Match exact required phrases and amount patterns only. Loose keyword checks (e.g. "hold") create false positives that waste reviewer time.
- **Truncated npm packages.** If an install hangs or is killed, a native `.node` binary may fail with "not a valid Win32 application" or JSON may be cut off. Fix with `npm ci`, not by patching single packages.

## Security

_None yet._
