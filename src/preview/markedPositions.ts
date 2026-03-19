/**
 * Add source positions to marked output via walkTokens + custom renderer.
 * Every HTML element gets data-src-start / data-src-end attributes mapping
 * back to byte offsets in the original markdown source.
 */

import { marked } from "marked"
import hljs from "highlight.js/lib/core"
import javascript from "highlight.js/lib/languages/javascript"
import typescript from "highlight.js/lib/languages/typescript"
import python from "highlight.js/lib/languages/python"
import rust from "highlight.js/lib/languages/rust"
import css from "highlight.js/lib/languages/css"
import xml from "highlight.js/lib/languages/xml"
import json from "highlight.js/lib/languages/json"
import bash from "highlight.js/lib/languages/bash"
import yaml from "highlight.js/lib/languages/yaml"
import sql from "highlight.js/lib/languages/sql"
import markdown from "highlight.js/lib/languages/markdown"

hljs.registerLanguage("javascript", javascript)
hljs.registerLanguage("js", javascript)
hljs.registerLanguage("jsx", javascript)
hljs.registerLanguage("typescript", typescript)
hljs.registerLanguage("ts", typescript)
hljs.registerLanguage("tsx", typescript)
hljs.registerLanguage("python", python)
hljs.registerLanguage("py", python)
hljs.registerLanguage("rust", rust)
hljs.registerLanguage("rs", rust)
hljs.registerLanguage("css", css)
hljs.registerLanguage("html", xml)
hljs.registerLanguage("xml", xml)
hljs.registerLanguage("json", json)
hljs.registerLanguage("bash", bash)
hljs.registerLanguage("sh", bash)
hljs.registerLanguage("shell", bash)
hljs.registerLanguage("yaml", yaml)
hljs.registerLanguage("yml", yaml)
hljs.registerLanguage("sql", sql)
hljs.registerLanguage("markdown", markdown)
hljs.registerLanguage("md", markdown)

/**
 * Parse markdown and return HTML with data-src-start/data-src-end attributes.
 * Strips YAML frontmatter and renders it as a quiet metadata block.
 */
export function parseWithPositions(source: string): string {
  let frontmatterHtml = ""
  let mdSource = source

  const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (fmMatch) {
    const yamlBody = fmMatch[1]
    const fmEnd = fmMatch[0].length
    mdSource = source.slice(fmEnd)

    const bold = new Set(["name", "title", "description"])
    const entries = parseYamlEntries(yamlBody)
    const rendered = entries.map(({ key, val }: { key: string; val: string }) => {
      if (bold.has(key.toLowerCase())) {
        return `<strong>${escapeHtml(key)}:</strong> <strong>${escapeHtml(val)}</strong>`
      }
      return `${escapeHtml(key)}: ${escapeHtml(val)}`
    })

    frontmatterHtml = `<div class="frontmatter" data-src-start="0" data-src-end="${fmEnd}">${rendered.join("<br/>")}</div>\n`
  }

  // Extract footnote definitions and replace markers before parsing
  const { processedSource, footnotesHtml } = processFootnotes(mdSource)

  const tokens = marked.lexer(processedSource)
  const offset = source.length - mdSource.length
  walkWithPosition(tokens, processedSource, 0, offset)
  const renderer = buildPositionRenderer()
  return frontmatterHtml + marked.parser(tokens, { renderer }) + footnotesHtml
}

// ─── Footnote / citation support ──────────────────────────────

function processFootnotes(source: string): { processedSource: string; footnotesHtml: string } {
  // Collect definitions: [^key]: text (can span multiple indented lines)
  const defs = new Map<string, string>()
  const defRe = /^\[\^([^\]]+)\]:\s*(.+(?:\n(?:  .+|\t.+))*)/gm
  let match
  while ((match = defRe.exec(source)) !== null) {
    const key = match[1]
    // Strip leading indentation from continuation lines but preserve newlines
    const text = match[2].replace(/\n[ \t]{2}/g, "\n").trim()
    defs.set(key, text)
  }

  if (defs.size === 0) return { processedSource: source, footnotesHtml: "" }

  // Remove definition lines from source
  let processed = source.replace(/^\[\^([^\]]+)\]:\s*(.+(?:\n(?:  .+|\t.+))*)\n?/gm, "")

  // Assign numbers in order of first appearance
  const keyToNum = new Map<string, number>()
  let counter = 0
  const markerRe = /\[\^([^\]]+)\]/g
  let m
  while ((m = markerRe.exec(processed)) !== null) {
    const key = m[1]
    if (defs.has(key) && !keyToNum.has(key)) {
      keyToNum.set(key, ++counter)
    }
  }

  // Replace inline markers with superscript citation links
  processed = processed.replace(/\[\^([^\]]+)\]/g, (_, key) => {
    const num = keyToNum.get(key)
    const text = defs.get(key)
    if (num == null || text == null) return `[^${key}]`
    const attrSafe = escapeHtml(text).replace(/\n/g, "&#10;")
    return `<sup class="citation-ref"><a href="#cite-${num}" data-citation="${attrSafe}">${num}</a></sup>`
  })

  // Build references section (render markdown in each reference)
  const ordered = [...keyToNum.entries()].sort((a, b) => a[1] - b[1])
  let footnotesHtml = `<section class="citations-section"><h2>References</h2><ol class="citations-list">`
  for (const [key, num] of ordered) {
    const text = defs.get(key) || ""
    footnotesHtml += `<li id="cite-${num}" value="${num}">${marked.parse(text)}</li>`
  }
  footnotesHtml += `</ol></section>`

  return { processedSource: processed, footnotesHtml }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function parseYamlEntries(yamlStr: string): { key: string; val: string }[] {
  const lines = yamlStr.split(/\r?\n/)
  const entries: { key: string; val: string }[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
    if (!match) { i++; continue }
    const key = match[1]
    let val = match[2].trim()

    if (val === ">" || val === "|" || val === ">-" || val === "|-") {
      const sep = (val[0] === ">") ? " " : "\n"
      const parts: string[] = []
      i++
      while (i < lines.length && (lines[i].match(/^\s+/) || lines[i].trim() === "")) {
        parts.push(lines[i].trim())
        i++
      }
      val = parts.join(sep).trim()
    } else {
      i++
    }
    entries.push({ key, val })
  }
  return entries
}

// ─── Position assignment ─────────────────────────────────────────

function walkWithPosition(tokens: any[], source: string, parentOffset: number, globalOffset = 0): void {
  for (const token of tokens) {
    if (!token.raw) continue

    const idx = source.indexOf(token.raw, parentOffset)
    if (idx !== -1) {
      token.position = { start: idx + globalOffset, end: idx + token.raw.length + globalOffset }
    }

    if (token.tokens) {
      const textStart = token.position
        ? findTextStart(token, globalOffset)
        : parentOffset
      walkWithPosition(token.tokens, source, textStart, globalOffset)
    }

    if (token.items) {
      walkWithPosition(token.items, source, token.position ? token.position.start - globalOffset : parentOffset, globalOffset)
    }

    if (token.header) {
      for (const cell of token.header) {
        if (cell.tokens) walkWithPosition(cell.tokens, source, token.position ? token.position.start - globalOffset : parentOffset, globalOffset)
      }
    }
    if (token.rows) {
      for (const row of token.rows) {
        for (const cell of row) {
          if (cell.tokens) walkWithPosition(cell.tokens, source, token.position ? token.position.start - globalOffset : parentOffset, globalOffset)
        }
      }
    }
  }
}

function findTextStart(token: any, globalOffset = 0): number {
  const start = token.position.start - globalOffset
  const raw = token.raw

  switch (token.type) {
    case "heading": {
      const match = raw.match(/^#{1,6}\s+/)
      return start + (match ? match[0].length : 0)
    }
    case "paragraph":
      return start
    case "blockquote": {
      const match = raw.match(/^>\s?/)
      return start + (match ? match[0].length : 0)
    }
    case "list_item": {
      const match = raw.match(/^(?:\d+[.)]\s+|[-*+]\s+)/)
      return start + (match ? match[0].length : 0)
    }
    default:
      return start
  }
}

// ─── Renderer with position attributes ───────────────────────────

function buildPositionRenderer(): any {
  const renderer = new marked.Renderer()

  function posAttrs(token: any): string {
    if (!token.position) return ""
    return ` data-src-start="${token.position.start}" data-src-end="${token.position.end}"`
  }

  renderer.heading = function (token: any) {
    const slug = token.text.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")
    return `<h${token.depth} id="${slug}"${posAttrs(token)}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`
  }

  renderer.paragraph = function (token: any) {
    return `<p${posAttrs(token)}>${this.parser.parseInline(token.tokens)}</p>\n`
  }

  renderer.blockquote = function (token: any) {
    return `<blockquote${posAttrs(token)}>${this.parser.parse(token.tokens)}</blockquote>\n`
  }

  renderer.list = function (token: any) {
    const tag = token.ordered ? "ol" : "ul"
    const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ""
    let body = ""
    for (const item of token.items) {
      body += renderer.listitem.call(this, item)
    }
    return `<${tag}${startAttr}${posAttrs(token)}>${body}</${tag}>\n`
  }

  renderer.listitem = function (token: any) {
    const content = (this.parser as any).parse(token.tokens, !!token.loose)
    return `<li${posAttrs(token)}>${content}</li>\n`
  }

  renderer.code = function (token: any) {
    // Widget blocks: render as hydration placeholder instead of code
    if (token.lang === "widget") {
      const escapedSpec = escapeHtml(token.text.trim())
      return `<div class="sono-widget-placeholder" data-widget-spec="${escapedSpec}"${posAttrs(token)}></div>\n`
    }

    // Diff code blocks: render as diff widget
    if (token.lang === "diff") {
      try {
        const parsed = JSON.parse(token.text)
        const spec = JSON.stringify({ widgetId: `diff-${token.position?.start || 0}`, type: "diff", ...parsed })
        const escapedSpec = escapeHtml(spec)
        return `<div class="sono-widget-placeholder" data-widget-spec="${escapedSpec}"${posAttrs(token)}></div>\n`
      } catch {
        // Fall through to render as regular code block if JSON is invalid
      }
    }

    // Mermaid code blocks: render as mermaid widget
    if (token.lang === "mermaid") {
      const spec = JSON.stringify({ widgetId: `mermaid-${token.position?.start || 0}`, type: "mermaid", diagram: token.text })
      const escapedSpec = escapeHtml(spec)
      return `<div class="sono-widget-placeholder" data-widget-spec="${escapedSpec}"${posAttrs(token)}></div>\n`
    }

    let highlighted: string
    if (token.lang && hljs.getLanguage(token.lang)) {
      highlighted = hljs.highlight(token.text, { language: token.lang }).value
    } else {
      highlighted = escapeHtml(token.text)
    }
    const langClass = token.lang ? ` class="language-${token.lang} hljs"` : ' class="hljs"'
    return `<pre${posAttrs(token)}><code${langClass}>${highlighted}</code></pre>\n`
  }

  renderer.html = function (token: any) {
    return token.text
  }

  renderer.table = function (token: any) {
    let header = "<thead><tr>"
    for (const cell of token.header) {
      const align = cell.align ? ` style="text-align:${cell.align}"` : ""
      header += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>`
    }
    header += "</tr></thead>"

    let body = ""
    for (const row of token.rows) {
      body += "<tr>"
      for (const cell of row) {
        const align = cell.align ? ` style="text-align:${cell.align}"` : ""
        body += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>`
      }
      body += "</tr>"
    }

    return `<table${posAttrs(token)}>${header}<tbody>${body}</tbody></table>\n`
  }

  renderer.strong = function (token: any) {
    return `<strong${posAttrs(token)}>${this.parser.parseInline(token.tokens)}</strong>`
  }

  renderer.em = function (token: any) {
    return `<em${posAttrs(token)}>${this.parser.parseInline(token.tokens)}</em>`
  }

  renderer.codespan = function (token: any) {
    return `<code${posAttrs(token)}>${escapeHtml(token.text)}</code>`
  }

  renderer.del = function (token: any) {
    return `<del${posAttrs(token)}>${this.parser.parseInline(token.tokens)}</del>`
  }

  renderer.link = function (token: any) {
    const title = token.title ? ` title="${token.title}"` : ""
    return `<a href="${token.href}"${title}${posAttrs(token)}>${this.parser.parseInline(token.tokens)}</a>`
  }

  renderer.image = function (token: any) {
    const title = token.title ? ` title="${token.title}"` : ""
    return `<img src="${token.href}" alt="${token.text}"${title}${posAttrs(token)} />`
  }

  ;(renderer as any).escape = function (token: any) {
    return token.text
  }

  renderer.text = function (token: any) {
    const inner = token.tokens
      ? this.parser.parseInline(token.tokens)
      : token.text
    if (token.position) {
      return `<span${posAttrs(token)}>${inner}</span>`
    }
    return inner
  }

  return renderer
}

// ─── DOM selection → source range mapping ────────────────────────

export function domRangeToSourceRange(domRange: Range): { start: number; end: number } | null {
  const start = resolveSourceOffset(domRange.startContainer, domRange.startOffset)
  const end = resolveSourceOffset(domRange.endContainer, domRange.endOffset)
  if (start == null || end == null) return null
  return { start, end }
}

function resolveSourceOffset(node: Node, offset: number): number | null {
  const el = findPositionedAncestor(node)
  if (!el) return null

  const srcStart = parseInt(el.getAttribute("data-src-start")!)
  const srcEnd = parseInt(el.getAttribute("data-src-end")!)
  if (isNaN(srcStart) || isNaN(srcEnd)) return null

  const textOff = textOffsetWithin(el, node, offset)
  const textLen = el.textContent!.length
  const srcLen = srcEnd - srcStart

  if (textLen === 0) return srcStart
  if (srcLen === textLen) return srcStart + Math.min(textOff, srcLen)
  return srcStart + Math.round((textOff / textLen) * srcLen)
}

function textOffsetWithin(ancestor: HTMLElement, node: Node, offset: number): number {
  let count = 0
  const walker = ancestor.ownerDocument.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    if (walker.currentNode === node) {
      return count + offset
    }
    count += walker.currentNode.textContent!.length
  }
  return count + offset
}

function findPositionedAncestor(node: Node): HTMLElement | null {
  let el: HTMLElement | null = node.nodeType === 3 ? node.parentElement : node as HTMLElement
  while (el) {
    if (el.hasAttribute?.("data-src-start")) return el
    el = el.parentElement
  }
  return null
}

// ─── Preview highlight wrapping ───────────────────────────────────

export function wrapSourceRange(container: HTMLElement, from: number, to: number, commentId: string): void {
  const candidates = container.querySelectorAll("[data-src-start]")

  const nonLeaf = new Set<Element>()
  for (const el of candidates) {
    const srcStart = parseInt(el.getAttribute("data-src-start")!)
    const srcEnd = parseInt(el.getAttribute("data-src-end")!)
    if (srcStart >= to || srcEnd <= from) continue
    const parent = el.parentElement?.closest("[data-src-start]")
    if (parent) nonLeaf.add(parent)
  }

  for (const el of candidates) {
    const srcStart = parseInt(el.getAttribute("data-src-start")!)
    const srcEnd = parseInt(el.getAttribute("data-src-end")!)
    if (srcStart >= to || srcEnd <= from) continue
    if (nonLeaf.has(el)) continue

    const textLen = el.textContent!.length
    const srcLen = srcEnd - srcStart
    if (textLen === 0 || srcLen === 0) continue

    let textFrom: number, textTo: number
    if (srcLen === textLen) {
      textFrom = Math.max(0, from - srcStart)
      textTo = Math.min(textLen, to - srcStart)
    } else {
      textFrom = Math.max(0, Math.round(((from - srcStart) / srcLen) * textLen))
      textTo = Math.min(textLen, Math.round(((to - srcStart) / srcLen) * textLen))
    }
    if (textFrom >= textTo) continue

    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let offset = 0
    const wraps: { node: Text; wrapFrom: number; wrapTo: number }[] = []
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const nodeEnd = offset + node.textContent!.length
      if (nodeEnd > textFrom && offset < textTo) {
        wraps.push({
          node,
          wrapFrom: Math.max(textFrom - offset, 0),
          wrapTo: Math.min(textTo - offset, node.textContent!.length),
        })
      }
      offset = nodeEnd
    }

    for (let i = wraps.length - 1; i >= 0; i--) {
      const { node, wrapFrom, wrapTo } = wraps[i]
      const range = el.ownerDocument.createRange()
      range.setStart(node, wrapFrom)
      range.setEnd(node, wrapTo)
      const span = el.ownerDocument.createElement("span")
      span.setAttribute("data-comment-highlight", "true")
      span.setAttribute("data-comment-id", commentId)
      range.surroundContents(span)
    }
  }
}

export function clearHighlights(container: HTMLElement): void {
  container.querySelectorAll("span[data-comment-highlight]").forEach(n => {
    n.replaceWith(...n.childNodes)
  })
  container.normalize()
}
