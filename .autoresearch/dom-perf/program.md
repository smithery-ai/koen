# DOM/Frontend Performance — Autoresearch Program

## Metric

**LCP (Largest Contentful Paint)** in ms. Lower is better. Baseline: 977ms.

Secondary metrics (don't optimize directly, track for regressions):
- CLS (baseline: 0.00 — must stay 0)
- Forced reflow time (baseline: 50ms)
- DOM node count (baseline: 405)
- CSS rule count (baseline: 522)

## Measurement

Chrome DevTools performance trace → LCP from NAVIGATION_0.
Also: `performance.now()` around key operations.

## Verification

After each change:
- CLS must stay 0
- posAtCoords click mapping must have 0 mismatches
- Build must pass, tests must pass

## Strategy (priority order)

### Phase 1: Lazy-load widgets (biggest LCP win)
Widget code blocks (map, calendar, chart) load CDN scripts synchronously during initial render.
The LiveWidgetType.toDOM() calls hydrate() which loads MapLibre GL (~500KB), Chart.js, etc.
Fix: render a placeholder first, hydrate async after LCP.

### Phase 2: Code-split the live editing extension
The createLiveEditing StateField imports LiveWidgetType, LiveTableWidget, BlockWrapper.
These should be lazy-imported so they don't block initial editor render.

### Phase 3: Reduce CSS rules
522 CSS rules. Many are preview-mode styles not needed in live mode.
Evaluate if live mode CSS can be split into a separate sheet.

### Phase 4: Reduce forced reflows
CM6's EditorView constructor causes 38ms forced reflow.
Check if our extensions add to this. Specifically: does buildDecorations
run synchronously during construction?

## Budget

10 experiments max. One change per experiment.

## Scope

- Modify: src/editor/live/LiveWidgetType.ts, src/editor/live/liveEditing.ts, src/styles/
- Don't touch: preview mode, source mode, core Editor.tsx, comment system
