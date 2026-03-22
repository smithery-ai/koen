# Visual Parity — Autoresearch Program

## Goal

Achieve maximum visual parity between preview mode and live mode, without breaking cursor/click mapping.

## Metric

**CSS property mismatch count** between preview and live for matching elements. Measured via Chrome DevTools evaluate_script — switch to preview, collect computed styles, switch to live, collect same, diff.

Elements to compare: h1, h2, h3, body text, strong, em, code, link, blockquote, code block, table, hr, task checkbox.

Properties to compare per element: font-size, font-weight, font-family, color, line-height, letter-spacing, text-decoration, background, border, margin-top, margin-bottom, padding.

Lower is better. Target: 0.

## Measurement Function

```javascript
// Run in Chrome DevTools — returns mismatch count
() => {
  const buttons = document.querySelectorAll('.toolbar button');

  const measure = (selectors) => {
    const result = {};
    for (const [name, sel] of Object.entries(selectors)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const s = getComputedStyle(el);
      result[name] = {
        fontSize: s.fontSize, fontWeight: s.fontWeight, fontFamily: s.fontFamily.substring(0,30),
        color: s.color, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
        marginTop: s.marginTop, marginBottom: s.marginBottom, paddingBottom: s.paddingBottom,
        borderBottom: s.borderBottom,
      };
    }
    return result;
  };

  // Preview selectors
  buttons[2].click();
  const preview = measure({
    h1: 'h1', h2: 'h2', h3: 'h3',
    strong: 'strong', em: 'em',
    code: 'code:not(pre code)', pre: 'pre',
    blockquote: 'blockquote', a: '.md-preview a',
  });

  // Live selectors
  buttons[1].click();
  const live = measure({
    h1: '.cm-live-h1', h2: '.cm-live-h2', h3: '.cm-live-h3',
    strong: '.cm-live-strong', em: '.cm-live-emphasis',
    code: '.cm-live-inline-code', pre: '.cm-live-fenced-code',
    blockquote: '.cm-live-blockquote', a: '.cm-live-link',
  });

  let mismatches = 0;
  const diffs = [];
  for (const name of Object.keys(preview)) {
    if (!live[name]) { mismatches++; continue; }
    for (const prop of Object.keys(preview[name])) {
      if (preview[name][prop] !== live[name]?.[prop]) {
        mismatches++;
        diffs.push({ el: name, prop, preview: preview[name][prop], live: live[name]?.[prop] });
      }
    }
  }
  return { mismatches, diffs };
}
```

## Cursor Verification Function

After each CSS change, verify clicks still work by checking cm-line heights haven't changed unexpectedly.

## Scope

- Modify: `src/styles/engei.css` (live editing CSS section)
- Modify: `src/editor/live/liveEditing.ts` (add line decorations if needed)
- Reference: `/tmp/cm6-view/src/` (CM6 source for understanding heightmap)
- Don't touch: preview mode CSS, source mode, widget code

## Strategy

1. **Measure baseline** — run measurement function, catalog all mismatches
2. **Fix safe properties first** — color, font-weight, font-family, letter-spacing, text-decoration (no height impact)
3. **Test Decoration.line() for spacing** — add heading line decorations with margin-top, verify heightmap stays valid
4. **Deep dive CM6 source** — understand exactly when heightmap re-measures after line decoration changes
5. **Iterate** — one property at a time, measure, keep or revert

## Constraints

- Never violate the 5 iron rules
- Never deploy to prod
- Commit each improvement separately
- Revert immediately if clicks break
