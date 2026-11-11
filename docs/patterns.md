# Patterns

Reusable patterns established in this project. Each entry: what it is, when to use it, and where it lives.

## Code

_None yet._

## Design / UX

- **No horizontal overflow on phones.** Use `minmax(0,1fr)` instead of `1fr` / `grid-cols-1` for grid tracks, add `min-w-0` to flex children that hold text, and let toolbar rows `flex-wrap` with `whitespace-nowrap` on buttons. Check at 320px: `document.documentElement.scrollWidth` must equal `clientWidth`.
- **Text contrast floor.** Smallest grey for text is `slate-600` (passes 4.5:1 on white, `slate-100`, `indigo-50`). Never use `opacity-*` to show a muted or rejected state on text; use a tinted background, dashed border, strike-through or a badge. Verify with axe-core `color-contrast` across every call, not one page load.

## Testing / QA

- **Verify AI output mechanically, then by hand.** For AI-generated findings: script-check that every quote is an exact substring and every cited ID exists, then read each finding against its source. Record precision in `docs/ai-verification.md`. Never hand-edit AI output to hide errors; let the reviewer reject it in the UI.
- **Deterministic checks must be narrow.** Match exact required phrases and amount patterns only. Loose keyword checks (e.g. "hold") create false positives that waste reviewer time.
- **Truncated npm packages.** If an install hangs or is killed, a native `.node` binary may fail with "not a valid Win32 application" or JSON may be cut off. Fix with `npm ci`, not by patching single packages.

## Security

_None yet._
