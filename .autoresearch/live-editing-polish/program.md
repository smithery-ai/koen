# Live Editing Polish — Autoresearch Program

## Metric

**Visual defect count.** Lower is better. Target: 0.

Measure by running a Chrome DevTools script that checks each polish dimension and returns a score. Each defect = 1 point. The script checks:

1. Font family is proportional (not monospace) for body text
2. Line height >= 1.6 for readability
3. Content font size >= 15px
4. Headings use proper foreground color (not syntax highlight accent)
5. CSS transitions exist on `.cm-live-hidden` elements
6. Code block has visible border-radius >= 6px and padding >= 12px
7. Heading line spacing has margin/padding for visual separation
8. Body text color has adequate contrast (WCAG AA)

### Measurement function

```javascript
() => {
  const content = document.querySelector('.cm-content');
  const cs = getComputedStyle(content);
  const line = document.querySelector('.cm-line');
  const ls = getComputedStyle(line);
  let defects = 0;
  const issues = [];

  // 1. Proportional font
  if (cs.fontFamily.includes('monospace') && !cs.fontFamily.includes('system-ui')) {
    defects++; issues.push('monospace body font');
  }

  // 2. Line height
  const lh = parseFloat(ls.lineHeight) / parseFloat(ls.fontSize);
  if (lh < 1.5) { defects++; issues.push('line-height ' + lh.toFixed(2) + ' < 1.5'); }

  // 3. Font size
  if (parseFloat(cs.fontSize) < 15) { defects++; issues.push('font-size ' + cs.fontSize + ' < 15px'); }

  // 4. Heading color — should not be the syntax highlight color
  const h2 = document.querySelector('.cm-live-h2');
  if (h2) {
    const h2Color = getComputedStyle(h2).color;
    const bodyColor = cs.color;
    // Heading should be similar to body color, not accent
    if (h2Color !== bodyColor) { defects++; issues.push('h2 color ' + h2Color + ' != body ' + bodyColor); }
  }

  // 5. Transitions on hidden elements
  const hidden = document.querySelector('.cm-live-hidden');
  if (hidden) {
    const t = getComputedStyle(hidden).transition;
    if (!t || t === 'all 0s ease 0s' || t === 'none') {
      defects++; issues.push('no transition on hidden elements');
    }
  }

  // 6. Code block styling
  const code = document.querySelector('.cm-live-fenced-code');
  if (code) {
    const ccs = getComputedStyle(code);
    if (parseFloat(ccs.borderRadius) < 6) { defects++; issues.push('code block border-radius < 6px'); }
    if (parseFloat(ccs.paddingLeft) < 12) { defects++; issues.push('code block padding < 12px'); }
  }

  // 7. Heading spacing
  // Hard to measure directly — skip for now

  // 8. Contrast — body color luminance
  // Skip complex calculation, just check it's not too dim

  return { defects, issues, target: 0 };
}
```

## Baseline

Run the measurement function above. Expect ~5-6 defects.

## Scope

- Modify: `src/styles/engei.css` (live editing CSS section), `src/editor/live/liveEditing.ts`
- Don't touch: `src/comments/`, `src/preview/`, existing source mode behavior

## Strategy

Priority order (highest visual impact first):

1. **Proportional font for body text** — switch from monospace to system UI font stack. This is the #1 thing that separates "code editor with hiding" from "real WYSIWYG". Keep monospace for inline code and code blocks only.

2. **Font size + line height** — increase to 16px / 1.6 line-height for document-like readability.

3. **Heading color override** — headings should use foreground color (--editor-fg), not the syntax highlight accent color. Override the HighlightStyle via CSS specificity.

4. **CSS transitions** — fade hidden elements in/out over 150ms. This is the "Notion feel."

5. **Code block visual treatment** — increase border-radius to 8px, add proper padding.

6. **Heading spacing** — add margin-top/bottom to heading lines for visual separation.

## Constraints

- Must still look correct in both dark and light themes
- Must not break source mode or preview mode
- Build must pass after each change
- Font changes only affect live mode (`.koen-editor-live` scope)
