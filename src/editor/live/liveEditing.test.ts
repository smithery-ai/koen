import { describe, it, expect } from "vitest"
import { EditorState, EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import { ensureSyntaxTree } from "@codemirror/language"
import { selectionOverlaps, cursorOnLine, buildDecorations } from "./liveEditing"

// ─── Helpers ──────────────────────────────────────────────────

function makeState(doc: string, cursor?: number) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: GFM })],
    selection: cursor != null ? EditorSelection.cursor(cursor) : undefined,
  })
}

function makeView(doc: string, cursor?: number): EditorView {
  const state = makeState(doc, cursor)
  const view = new EditorView({ state })
  // Force the parser to complete
  ensureSyntaxTree(view.state, view.state.doc.length, 5000)
  return view
}

function getDecorationClasses(view: EditorView): string[] {
  const decos = buildDecorations(view.state).decorations
  const classes: string[] = []
  const iter = decos.iter()
  while (iter.value) {
    const cls = iter.value.spec?.class || iter.value.spec?.attributes?.class
    if (cls) classes.push(cls)
    iter.next()
  }
  return classes
}

function getDecorationRanges(view: EditorView): { class: string; from: number; to: number }[] {
  const decos = buildDecorations(view.state).decorations
  const result: { class: string; from: number; to: number }[] = []
  const iter = decos.iter()
  while (iter.value) {
    const cls = iter.value.spec?.class || iter.value.spec?.attributes?.class
    if (cls) result.push({ class: cls, from: iter.from, to: iter.to })
    iter.next()
  }
  return result
}

// ─── selectionOverlaps ────────────────────────────────────────

describe("selectionOverlaps", () => {
  function ranges(...positions: [number, number][]) {
    return positions.map(([from, to]) => EditorSelection.range(from, to))
  }

  it("returns true when cursor is inside range", () => {
    expect(selectionOverlaps(ranges([5, 5]), 0, 10)).toBe(true)
  })

  it("returns false when cursor is outside range", () => {
    expect(selectionOverlaps(ranges([15, 15]), 0, 10)).toBe(false)
  })

  it("returns true when selection overlaps range partially", () => {
    expect(selectionOverlaps(ranges([5, 15]), 0, 10)).toBe(true)
  })

  it("returns true when selection contains the range", () => {
    expect(selectionOverlaps(ranges([0, 20]), 5, 10)).toBe(true)
  })

  it("returns true when edges touch", () => {
    expect(selectionOverlaps(ranges([10, 10]), 0, 10)).toBe(true)
    expect(selectionOverlaps(ranges([0, 0]), 0, 10)).toBe(true)
  })

  it("returns false for empty ranges array", () => {
    expect(selectionOverlaps([], 0, 10)).toBe(false)
  })

  it("returns true if ANY of multiple ranges overlaps", () => {
    expect(selectionOverlaps(ranges([50, 50], [5, 5]), 0, 10)).toBe(true)
  })

  it("returns false if none of multiple ranges overlap", () => {
    expect(selectionOverlaps(ranges([50, 50], [20, 25]), 0, 10)).toBe(false)
  })
})

// ─── cursorOnLine ─────────────────────────────────────────────

describe("cursorOnLine", () => {
  it("returns true when cursor is on the same line as node", () => {
    // "hello\nworld" — cursor at pos 8 (on line 2), node at 6-11 (line 2)
    const view = makeView("hello\nworld", 8)
    const ranges = view.state.selection.ranges
    expect(cursorOnLine(view.state, ranges, 6, 11)).toBe(true)
  })

  it("returns false when cursor is on a different line", () => {
    const view = makeView("hello\nworld", 2) // cursor on line 1
    const ranges = view.state.selection.ranges
    expect(cursorOnLine(view.state, ranges, 6, 11)).toBe(false) // node on line 2
  })

  it("returns true for multi-line node when cursor is on any covered line", () => {
    // "aaa\nbbb\nccc" — node spans lines 1-3 (0-11), cursor on line 2 (pos 5)
    const view = makeView("aaa\nbbb\nccc", 5)
    const ranges = view.state.selection.ranges
    expect(cursorOnLine(view.state, ranges, 0, 11)).toBe(true)
  })

  it("returns true for non-empty selection overlapping node", () => {
    const state = EditorState.create({
      doc: "hello\nworld",
      extensions: [markdown({ extensions: GFM })],
      selection: EditorSelection.range(2, 8), // spans both lines
    })
    const view = new EditorView({ state })
    const ranges = view.state.selection.ranges
    expect(cursorOnLine(view.state, ranges, 6, 11)).toBe(true)
  })

  it("returns false for non-empty selection NOT overlapping node", () => {
    const state = EditorState.create({
      doc: "hello\nworld\nfoo",
      extensions: [markdown({ extensions: GFM })],
      selection: EditorSelection.range(0, 3), // only on line 1
    })
    const view = new EditorView({ state })
    const ranges = view.state.selection.ranges
    expect(cursorOnLine(view.state, ranges, 12, 15)).toBe(false) // node on line 3
  })
})

// ─── buildDecorations: headings ───────────────────────────────

describe("buildDecorations — headings", () => {
  it("applies heading mark to h1", () => {
    const view = makeView("# Hello\n\nsome text", 15) // cursor on "some text"
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-h1")
  })

  it("applies heading mark to h2 and h3", () => {
    const view = makeView("## Two\n\n### Three\n\ntext", 20)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-h2")
    expect(classes).toContain("cm-live-h3")
  })

  it("hides HeaderMark when cursor is NOT on heading line", () => {
    const view = makeView("# Hello\n\nsome text", 15)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-hidden")
  })

  it("keeps heading styled and # hidden even when cursor IS on heading line", () => {
    const view = makeView("# Hello\n\nsome text", 3) // cursor inside heading
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-h1")
    expect(classes).toContain("cm-live-hidden") // # always hidden (Notion style)
  })

  it("does not crash when heading is at end of doc without trailing newline", () => {
    // This tests the HeaderMark +1 clamping
    const view = makeView("# End", 0)
    expect(() => buildDecorations(view.state).decorations).not.toThrow()
  })

  it("does not crash on single # with no content", () => {
    const view = makeView("#", 0)
    expect(() => buildDecorations(view.state).decorations).not.toThrow()
  })
})

// ─── buildDecorations: inline formatting ──────────────────────

describe("buildDecorations — inline formatting", () => {
  it("applies bold mark and hides delimiters when cursor is away", () => {
    const view = makeView("**bold** text", 12) // cursor on "text"
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-strong")
    expect(classes).toContain("cm-live-hidden") // ** hidden
  })

  it("keeps bold styled even when cursor is inside", () => {
    const view = makeView("**bold** text", 4) // cursor inside "bold"
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-strong") // always styled
    expect(classes).toContain("cm-live-hidden") // ** always hidden
  })

  it("applies italic mark when cursor is away", () => {
    const view = makeView("*italic* text", 12)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-emphasis")
  })

  it("applies inline code mark when cursor is away", () => {
    const view = makeView("`code` text", 10)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-inline-code")
  })

  it("applies link mark when cursor is away", () => {
    const view = makeView("[text](https://example.com) more", 30)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-link")
  })

  it("does not create decorations for empty document", () => {
    const view = makeView("", 0)
    const classes = getDecorationClasses(view)
    expect(classes).toHaveLength(0)
  })
})

// ─── buildDecorations: blockquotes ────────────────────────────

describe("buildDecorations — blockquotes", () => {
  it("applies blockquote styling always", () => {
    const view = makeView("> quoted text\n\nnormal", 18)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-blockquote")
  })

  it("hides QuoteMark when cursor is NOT on blockquote line", () => {
    const view = makeView("> quoted text\n\nnormal", 18) // cursor on "normal"
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-hidden") // > hidden
  })

  it("keeps QuoteMark hidden even when cursor IS on blockquote line", () => {
    const view = makeView("> quoted text\n\nnormal", 5) // cursor on blockquote line
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-hidden") // > always hidden
  })
})

// ─── buildDecorations: fenced code ────────────────────────────

describe("buildDecorations — fenced code", () => {
  const codeDoc = "text\n\n```js\nconst x = 1\n```\n\nmore text"

  it("applies fenced code mark when cursor is outside", () => {
    const view = makeView(codeDoc, 2) // cursor on "text"
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-fenced-code")
  })

  it("applies fence line decorations when cursor is outside", () => {
    const view = makeView(codeDoc, 2)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-fence-line")
  })

  it("keeps code block styled even when cursor is inside", () => {
    const view = makeView(codeDoc, 14) // cursor on "const x = 1"
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-fenced-code") // always styled
  })
})

// ─── buildDecorations: strikethrough (GFM) ────────────────────

describe("buildDecorations — strikethrough", () => {
  it("applies strikethrough mark when cursor is away", () => {
    const view = makeView("~~struck~~ text", 14)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-strikethrough")
  })

  it("keeps strikethrough styled even when cursor is inside", () => {
    const view = makeView("~~struck~~ text", 5)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-strikethrough") // always styled
  })
})

// ─── Edge cases from adversarial testing ──────────────────────

describe("buildDecorations — edge cases", () => {
  it("handles document with only a heading mark (no content)", () => {
    expect(() => makeView("# ", 0)).not.toThrow()
    expect(() => makeView("## ", 0)).not.toThrow()
  })

  it("handles heading at very end of doc (no trailing newline)", () => {
    const view = makeView("text\n# End", 10) // cursor at end
    expect(() => buildDecorations(view.state).decorations).not.toThrow()
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-h1")
  })

  it("handles plain text with no markdown", () => {
    const view = makeView("Just plain text here.", 5)
    const classes = getDecorationClasses(view)
    expect(classes).toHaveLength(0)
  })

  it("handles multiple formatting on same line", () => {
    // Put cursor on a separate line so no formatted range is "active"
    const view = makeView("**bold** and *italic* and `code`\n\naway", 35)
    const classes = getDecorationClasses(view)
    expect(classes).toContain("cm-live-strong")
    expect(classes).toContain("cm-live-emphasis")
    expect(classes).toContain("cm-live-inline-code")
  })
})
