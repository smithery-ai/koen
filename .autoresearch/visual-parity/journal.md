# Visual Parity — Experiment Journal

**Started**: 2026-03-22
**Metric**: CSS property mismatch count (lower is better)

---

## Pre-experiment: Click offset investigation

**Finding**: Chrome DevTools simulated clicks (dispatchEvent, element.click())
land on the wrong line even in SOURCE MODE with zero decorations. This is a
testing artifact — CM6's posAtCoords doesn't process synthetic MouseEvents
the same way as real browser clicks. The "click offset bug" we spent hours
debugging was our testing methodology, not our code.

**Action**: Cannot use Chrome DevTools click simulation to verify cursor mapping.
Must test real clicks manually in the browser/Tauri app.

**Approach change**: Use heading font-size via Decoration.line() (on .cm-line div)
instead of Decoration.mark() (on inline span). This is architecturally correct
regardless of the testing artifact — CM6 should measure .cm-line height including
line decoration CSS.

---

