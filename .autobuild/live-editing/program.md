# Live Editing Mode — Build Program (Council-Revised)

## Spec

Add a third editor mode `mode="live"` to engei — a WYSIWYG-style live editing experience for markdown content (like Obsidian's Live Preview).

**Core behavior:** CM6 ViewPlugin walks the Lezer markdown tree for the visible viewport, creates decorations to hide markdown syntax and style content. When the cursor is on a line, decorations are removed to reveal raw markdown for editing. Document stays raw markdown — decorations are visual only.

**v1 scope (council-approved):**
- Headings: `# Heading` renders as styled heading, `#` hidden when cursor not on line
- Bold/italic/strikethrough/inline code: single abstraction — hide delimiter, style content
- Links: `[text](url)` renders as styled link, syntax hidden
- Blockquotes: `>` gets styled left border
- Code blocks: fenced blocks get background + language label
- Theme-aware: all decorations respect dark/light theme via CSS variables
- Comments system works (offsets unchanged, but verify visual positioning)
- onChange fires with raw markdown

**Cut from v1:** Images, horizontal rules, lists (ship in v1.1)

## Steps

### Phase 0 — Validate UX direction
1. CSS-only v0: hide `.tok-meta` on non-active lines. 4 lines of CSS. Proves the concept.
2. Build minimal demo app (demo/ dir with Vite + React) to test all modes.

### Phase 1 — Foundation
3. Create `src/editor/live/liveEditing.ts` — ViewPlugin infrastructure:
   - Walk Lezer tree for visible viewport only (perf)
   - Cursor-awareness: skip decorations for lines containing the cursor
   - Return DecorationSet
4. Heading decorations — hide HeaderMark nodes, apply heading font sizes via Decoration.mark()
5. Wire `mode="live"` into Editor.tsx and types.ts

### Phase 2 — Inline formatting (ONE abstraction)
6. Build `hideDelimiter(nodeType, openMark, closeMark, style)` helper
7. Bold + italic + bold/italic + strikethrough + inline code — all use the helper
8. Links — hide `[`, `](url)`, style link text, preserve click behavior

### Phase 3 — Block elements
9. Code blocks — fenced blocks get background styling, hide fence markers when cursor not on block
10. Blockquotes — hide `>` marker, add left border + indentation styling

### Phase 4 — Integration
11. Theme integration — all decorations use CSS variables from existing theme
12. Verify comments work in live mode (CommentPill positioning, CommentMargin alignment)
13. Final end-to-end verification in demo app

## Existing Patterns

- CodeMirror editor: `src/editor/CodeMirrorEditor.tsx` — Compartments for reconfiguration
- Theme: `src/editor/theme.ts` — `buildSonoTheme(isDark)` returns CM6 theme extension
- Comment decorations: `src/comments/CommentDecoration.ts` — StateField + Decoration pattern
- CSS variables: `src/styles/variables.css`
- Editor modes: `mode?: "source" | "preview"` in `src/types.ts`

## Scope

- Create: `src/editor/live/` directory, `demo/` directory
- Modify: `src/Editor.tsx`, `src/types.ts`, `src/styles/engei.css`
- Don't touch: `src/preview/`, `src/comments/anchoring.ts`, `engei-widgets/`

## Verification

**DO NOT deploy or push to production. Local dev testing only. Deploy only after explicit human approval.**

### After every step
- `bun run build` must pass
- `bun run test` must pass (existing tests still green)

### Demo app (primary testing vehicle)
Minimal Vite + React app importing Editor with `mode="live"` and sample markdown. Run locally, verify in browser.

### Visual verification (Chrome DevTools, after each phase)
- Screenshot the demo app
- Dark + light theme
- Cursor on decorated line → raw markdown visible
- Cursor away → rendered view

### What WON'T work for testing
- jsdom integration tests for CM6 decorations (CM6 needs real DOM measurements)
- Test decoration logic via unit tests on the pure functions, visual behavior via demo app

## Key Technical Notes (from council)

- **ViewPlugin not StateField** — decorations depend on cursor position (view-dependent)
- **Viewport-only** — use `view.viewport` to only decorate visible ranges, not full document
- **Nested formatting** — `***bold italic***` requires decomposing nested Lezer Emphasis nodes. Budget extra time.
- **Comment offsets are safe** — raw doc unchanged. But `coordsAtPos()` will return different visual positions when decorations toggle. CommentPill/CommentMargin may need attention.
- **Decoration.replace() cursor behavior** — cursor can land inside hidden ranges. May need `inclusiveStart/End` tuning.
