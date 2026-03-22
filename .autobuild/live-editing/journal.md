# Live Editing Mode — Build Journal

**Started**: 2026-03-22
**Branch**: feat/live-editing

---

## Step 1: Foundation + all decorations + wiring (6f705e0)
- Intent: Create ViewPlugin, CSS, wire mode="live" into Editor.tsx
- Research: Cloned codemirror-rich-markdoc, MarkBloom (cm6-live-preview-core), HyperMD into /tmp/
- Key decision: Use `Decoration.mark()` with CSS classes (not `Decoration.replace()`)
- Result: COMMITTED

## Step 2: GFM strikethrough + fence line collapse (ec5cb82)
- Intent: Fix strikethrough (needed GFM parser extension) and collapse ``` fence lines
- Result: COMMITTED

## Step 3: Visual polish (bdfab5f)
- Intent: Proportional font, heading colors, code block styling, transitions
- Changes: font-family → system UI, 16px/1.7, heading color override, code block 8px radius + 12px padding, CSS transitions on hidden elements
- Metric: visual defect count 5 → 0
- Result: COMMITTED

## Step 4: Adversarial hardening (f557c41)
- Intent: Fix critical bugs found by council adversarial testing
- Council identified: HeaderMark +1 overrun, QuoteMark always hidden, multi-cursor ignored, zero-width range guards
- Fixes: clamp HeaderMark to doc.length, line-based cursor guard on QuoteMark, use all selection.ranges, guard zero-width ranges
- Result: COMMITTED

## Council adversarial testing results (2026-03-22)

### Confirmed bugs fixed:
- ✅ HeaderMark `node.to + 1` clamped to `doc.length` (prevents RangeError crash)
- ✅ QuoteMark has line-based cursor guard (`>` revealed when cursor on line)
- ✅ Multi-cursor: all `selection.ranges` checked, not just `.main`
- ✅ Zero-width decoration ranges guarded
- ✅ Cursor reveal uses line-based check (Obsidian-style)

### Verified working:
- ✅ QuoteMark reveal on cursor line (confirmed via screenshot)
- ✅ Comment system works in live mode (CommentPill appeared)
- ✅ Headings stay styled with cursor on line, `#` revealed

### Known limitations (documented, not fixed):
- ArrowDown navigation can get stuck before blockquote (CM6 + zero-width hidden content)
- Copy gives raw markdown, not visual (intentional — document is markdown)
- No IME composition guard (v2)
- No screen reader aria-hidden on hidden spans (v2)
- No mobile touch degradation (v2)
- CSS transitions on hidden elements may cause jitter during rapid undo (minor)

## Commits on feat/live-editing

```
f557c41 fix: harden live editing against council-identified bugs
bdfab5f style: polish live editing — proportional font, heading colors, code blocks
bd93e5a docs: update autobuild journal with visual verification results
ec5cb82 fix: GFM strikethrough support + collapse code fence lines
6f705e0 feat: add live editing mode with CM6 ViewPlugin decorations
```
