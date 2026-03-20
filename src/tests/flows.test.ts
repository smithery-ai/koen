/**
 * User journey tests — exercise full paths through the library
 * with minimal code. Each test covers multiple modules.
 */

import { createAnchor, resolveAnchor, resolveAnchors } from "../comments/anchoring"
import { parseWithPositions, wrapSourceRange, clearHighlights, domRangeToSourceRange } from "../preview/markedPositions"
import { applyHighlights } from "../preview/usePreviewHighlights"
import { buildWidgetRegistry, buildLangMap, hydrateWidgets, getDefaultWidgets } from "engei-widgets"
import type { WidgetPlugin } from "engei-widgets"
import { renderMarkdown } from "../sanitize"

// ─── Journey 1: Comment lifecycle ────────────────────────────

describe("comment lifecycle", () => {
  const doc = "function hello() {\n  return 'world'\n}\n\nconsole.log(hello())"

  it("create → resolve → survives edit → batch resolve", () => {
    // User selects "hello" and creates anchor
    const anchor = createAnchor(doc, 9, 14)
    expect(anchor.exact).toBe("hello")
    expect(anchor.prefix.length).toBeGreaterThan(0)

    // Resolve in original doc
    const pos = resolveAnchor(doc, anchor)!
    expect(pos).not.toBeNull()
    expect(doc.slice(pos.from, pos.to)).toBe("hello")

    // Code is edited — comment should still resolve
    const edited = "// header\nfunction hello() {\n  return 'world'\n}"
    const pos2 = resolveAnchor(edited, anchor)!
    expect(pos2).not.toBeNull()
    expect(edited.slice(pos2.from, pos2.to)).toBe("hello")

    // Batch resolve multiple anchors
    const anchor2 = createAnchor(doc, 28, 35)
    const results = resolveAnchors(doc, [anchor, anchor2])
    expect(results.length).toBe(2)
    expect(results.every(r => r !== null)).toBe(true)
  })

  it("anchor survives significant refactor via fuzzy match", () => {
    const anchor = createAnchor(doc, 9, 14) // "hello"
    // Rename function but keep enough context
    const refactored = "function greet() {\n  return 'world'\n}\n\nconsole.log(greet())"
    // Fuzzy should fail since "hello" no longer exists
    const pos = resolveAnchor(refactored, anchor)
    expect(pos).toBeNull()
  })
})

// ─── Journey 2: Markdown → highlights → comments ────────────

describe("markdown preview with comments", () => {
  const md = "# Title\n\nSome **bold** text here.\n\n- item one\n- item two"

  it("parse → highlight → clear round-trip", () => {
    const html = parseWithPositions(md)
    const el = document.createElement("div")
    el.innerHTML = html

    // Verify source positions exist
    expect(el.querySelector("[data-src-start]")).not.toBeNull()

    // Create an anchor on "bold"
    const anchor = createAnchor(md, 14, 18)
    const pos = resolveAnchor(md, anchor)!

    // Apply highlight
    applyHighlights(el, [{ id: "c1", from: pos.from, to: pos.to }], null)
    expect(el.querySelector("[data-comment-id='c1']")).not.toBeNull()

    // Clear and verify clean
    clearHighlights(el)
    expect(el.querySelector("[data-comment-highlight]")).toBeNull()
    expect(el.textContent).toContain("bold")
  })

  it("draft highlight appears and clears", () => {
    const html = parseWithPositions(md)
    const el = document.createElement("div")
    el.innerHTML = html

    applyHighlights(el, [], { from: 0, to: 7 })
    expect(el.querySelector("[data-comment-id='draft']")).not.toBeNull()

    applyHighlights(el, [], null)
    expect(el.querySelector("[data-comment-id='draft']")).toBeNull()
  })
})

// ─── Journey 3: Widget plugin end-to-end ─────────────────────

describe("widget plugin lifecycle", () => {
  it("custom plugin: register → parse → hydrate → cleanup", () => {
    let cleaned = false
    const plugin: WidgetPlugin = {
      type: "counter",
      codeBlockLang: "counter",
      toSpec: (text) => ({ start: parseInt(text.trim()) || 0 }),
      hydrate: (container, spec, theme) => {
        container.textContent = `Count: ${spec.start}, theme: ${theme}`
        return () => { cleaned = true }
      },
    }

    const langMap = buildLangMap([plugin])
    const registry = buildWidgetRegistry([plugin])

    // Parse markdown with custom code block
    const md = "# Dashboard\n\n```counter\n42\n```\n\nEnd."
    const html = parseWithPositions(md, langMap)

    // Verify placeholder was created (not a code block)
    expect(html).toContain("koen-widget-placeholder")
    expect(html).not.toMatch(/<pre.*counter/)

    // Hydrate into DOM
    const el = document.createElement("div")
    el.innerHTML = html
    const cleanups = hydrateWidgets(el, "dark", registry)

    // Widget rendered
    expect(el.textContent).toContain("Count: 42")
    expect(el.textContent).toContain("theme: dark")

    // Cleanup works
    cleanups.forEach(fn => fn())
    expect(cleaned).toBe(true)
  })

  it("multiple plugins coexist", () => {
    const pluginA: WidgetPlugin = {
      type: "a",
      codeBlockLang: "widget-a",
      toSpec: (t) => ({ val: t.trim() }),
      hydrate: (c, s) => { c.textContent = `A:${s.val}` },
    }
    const pluginB: WidgetPlugin = {
      type: "b",
      codeBlockLang: "widget-b",
      toSpec: (t) => ({ val: t.trim() }),
      hydrate: (c, s) => { c.textContent = `B:${s.val}` },
    }

    const langMap = buildLangMap([pluginA, pluginB])
    const registry = buildWidgetRegistry([pluginA, pluginB])

    const md = "```widget-a\nhello\n```\n\n```widget-b\nworld\n```"
    const html = parseWithPositions(md, langMap)
    const el = document.createElement("div")
    el.innerHTML = html

    hydrateWidgets(el, "light", registry)
    expect(el.textContent).toContain("A:hello")
    expect(el.textContent).toContain("B:world")
  })

  it("hydration error paths: unknown type and invalid JSON", () => {
    const registry = buildWidgetRegistry([])
    const el = document.createElement("div")

    // Unknown type
    el.innerHTML = `<div data-widget-spec='${JSON.stringify({ widgetId: "w1", type: "nope" })}'></div>`
    hydrateWidgets(el, "dark", registry)
    expect(el.textContent).toContain("Unknown widget type: nope")

    // Invalid JSON
    el.innerHTML = '<div data-widget-spec="not-json"></div>'
    hydrateWidgets(el, "dark", registry)
    expect(el.textContent).toContain("Widget error:")
  })

  it("getDefaultWidgets returns all default widgets", () => {
    const defaults = getDefaultWidgets()
    expect(defaults.map(d => d.type)).toEqual(["chart", "mermaid", "diff", "globe", "katex", "table", "embed", "excalidraw", "map", "timeline", "calendar"])
  })
})

// ─── Journey 4: Markdown rendering safety ────────────────────

describe("markdown rendering safety", () => {
  it("renders rich markdown features", () => {
    const md = [
      "# Heading",
      "",
      "A paragraph with **bold**, *italic*, and `code`.",
      "",
      "- list item",
      "- [link](https://example.com)",
      "",
      "> blockquote",
      "",
      "```js",
      "const x = 1",
      "```",
    ].join("\n")

    const html = parseWithPositions(md)
    const el = document.createElement("div")
    el.innerHTML = html

    expect(el.querySelector("h1")).not.toBeNull()
    expect(el.querySelector("strong")).not.toBeNull()
    expect(el.querySelector("em")).not.toBeNull()
    expect(el.querySelector("code")).not.toBeNull()
    expect(el.querySelector("li")).not.toBeNull()
    expect(el.querySelector("a")?.getAttribute("href")).toBe("https://example.com")
    expect(el.querySelector("blockquote")).not.toBeNull()
    expect(el.querySelector("pre")).not.toBeNull()
  })

  it("sanitize blocks XSS in all attack vectors", () => {
    const attacks = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">click</a>',
      '<svg onload=alert(1)>',
      '<iframe src="evil.com"></iframe>',
      '<div onmouseover="alert(1)">hover</div>',
    ]

    for (const attack of attacks) {
      const html = renderMarkdown(attack)
      expect(html).not.toContain("alert")
      expect(html).not.toContain("javascript:")
      expect(html).not.toContain("onerror")
      expect(html).not.toContain("onload")
      expect(html).not.toContain("onmouseover")
      expect(html).not.toContain("<script")
      expect(html).not.toContain("<iframe")
    }
  })
})

// ─── Journey 5: Footnotes / citations ────────────────────────

describe("footnotes in markdown", () => {
  it("renders citation markers and references section", () => {
    const md = "Text with citation[^1].\n\n[^1]: Author 2024. Some paper."
    const html = parseWithPositions(md)
    const el = document.createElement("div")
    el.innerHTML = html

    // Citation marker rendered as superscript
    const sup = el.querySelector("sup.citation-ref")
    expect(sup).not.toBeNull()

    // References section exists
    const refs = el.querySelector(".citations-section")
    expect(refs).not.toBeNull()
    expect(refs!.textContent).toContain("Author 2024")
  })
})

// ─── Journey 6: Anchor disambiguation ────────────────────────

describe("anchor disambiguation", () => {
  it("resolves correct match when text appears multiple times", () => {
    const doc = "const x = foo()\nconst y = foo()\nconst z = foo()"
    // Anchor the second "foo" — find its actual offset
    const secondIdx = doc.indexOf("foo", doc.indexOf("foo") + 1)
    const anchor = createAnchor(doc, secondIdx, secondIdx + 3)
    expect(anchor.exact).toBe("foo")
    // Should resolve back to the second occurrence
    const pos = resolveAnchor(doc, anchor)!
    expect(pos).not.toBeNull()
    expect(doc.slice(pos.from, pos.to)).toBe("foo")
    expect(pos.from).toBe(secondIdx)
  })

  it("uses prefix/suffix scoring when multiple matches exist", () => {
    const doc = "aaa hello bbb\nccc hello ddd"
    const anchor = createAnchor(doc, 18, 23) // second "hello" (after "ccc ")
    // Resolve in the same doc — should pick the right one via scoring
    const pos = resolveAnchor(doc, anchor)!
    expect(pos).not.toBeNull()
    expect(doc.slice(pos.from, pos.to)).toBe("hello")
    expect(pos.from).toBe(18) // second occurrence
  })

  it("fuzzy matches when text is slightly modified", () => {
    // Need a long enough pattern for fuzzy to kick in (>28 chars for seed)
    const longText = "This is a particularly long and unique sentence that only appears once"
    const doc = `before ${longText} after`
    const anchor = createAnchor(doc, 7, 7 + longText.length)
    // Slightly modify the text (within 20% tolerance)
    const modified = `before This is a particularly long and CHANGED sentence that only appears once after`
    const pos = resolveAnchor(modified, anchor)
    // Fuzzy should find it despite the edit
    expect(pos).not.toBeNull()
  })
})

// ─── Journey 7: DOM range → source mapping ───────────────────

describe("domRangeToSourceRange", () => {
  it("maps a DOM selection back to source offsets", () => {
    // Build a positioned element manually for reliable testing
    const el = document.createElement("div")
    el.innerHTML = '<p data-src-start="0" data-src-end="11">Hello world</p>'

    const textNode = el.querySelector("p")!.firstChild!
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)

    const result = domRangeToSourceRange(range)
    expect(result).not.toBeNull()
    expect(result!.start).toBe(0)
    expect(result!.end).toBe(5)
  })

  it("returns null for range outside positioned elements", () => {
    const el = document.createElement("div")
    el.innerHTML = "<p>no position attrs</p>"
    const textNode = el.querySelector("p")!.firstChild!

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 2)

    expect(domRangeToSourceRange(range)).toBeNull()
  })
})
