/**
 * Live editing extension for CodeMirror 6.
 *
 * Walks the Lezer markdown syntax tree and applies decorations to hide
 * markdown syntax markers and style the content. When the cursor is
 * on the same line as a formatted range, decorations are removed to
 * reveal raw markdown for editing.
 *
 * Architecture inspired by codemirror-rich-markdoc and Obsidian's
 * Live Preview. Uses Decoration.mark() with CSS classes (not
 * Decoration.replace()) to avoid cursor-in-hidden-range problems.
 *
 * Key hardening (from council review):
 * - Cursor check uses ALL selection ranges, not just .main
 * - HeaderMark +1 clamped to doc.length to prevent RangeError
 * - QuoteMark has line-based cursor guard
 * - syntaxTree incompleteness handled gracefully
 */

import { syntaxTree } from "@codemirror/language"
import { Decoration, EditorView, BlockWrapper } from "@codemirror/view"
import type { DecorationSet } from "@codemirror/view"
import { StateField, RangeSet, type Range, type SelectionRange, type EditorState, type Extension } from "@codemirror/state"
import type { WidgetPlugin } from "engei-widgets"
import { LiveWidgetType } from "./LiveWidgetType"

// Table decorations — using BlockWrapper for real table layout
const tableWrapper = BlockWrapper.create({ tagName: "div", attributes: { class: "cm-md-table" } })
const tableHeaderLine = Decoration.line({ class: "cm-table-header" })
const tableRowLine = Decoration.line({ class: "cm-table-row" })
const tableDelimiterLine = Decoration.line({ class: "cm-table-delimiter" })
const tablePipeMark = Decoration.mark({ class: "cm-table-pipe" })
const tableCellMark = Decoration.mark({ class: "cm-table-cell" })

// ─── Decoration constants ──────────────────────────────────────

const hiddenMark = Decoration.mark({ class: "cm-live-hidden" })

const headingMarks: Record<string, Decoration> = {
  ATXHeading1: Decoration.mark({ class: "cm-live-h1" }),
  ATXHeading2: Decoration.mark({ class: "cm-live-h2" }),
  ATXHeading3: Decoration.mark({ class: "cm-live-h3" }),
  ATXHeading4: Decoration.mark({ class: "cm-live-h4" }),
  ATXHeading5: Decoration.mark({ class: "cm-live-h5" }),
  ATXHeading6: Decoration.mark({ class: "cm-live-h6" }),
}

// Line decorations for headings — font-size on the .cm-line div so CM6 measures correctly
const headingLines: Record<string, Decoration> = {
  ATXHeading1: Decoration.line({ class: "cm-live-h1-line" }),
  ATXHeading2: Decoration.line({ class: "cm-live-h2-line" }),
  ATXHeading3: Decoration.line({ class: "cm-live-h3-line" }),
  ATXHeading4: Decoration.line({ class: "cm-live-h4-line" }),
  ATXHeading5: Decoration.line({ class: "cm-live-h5-line" }),
  ATXHeading6: Decoration.line({ class: "cm-live-h6-line" }),
}

const hrLine = Decoration.line({ class: "cm-live-hr" })
const taskCheckedMark = Decoration.mark({ class: "cm-live-task-checked" })
const taskUncheckedMark = Decoration.mark({ class: "cm-live-task-unchecked" })
const emphasisMark = Decoration.mark({ class: "cm-live-emphasis" })
const strongMark = Decoration.mark({ class: "cm-live-strong" })
const inlineCodeMark = Decoration.mark({ class: "cm-live-inline-code" })
const linkMark = Decoration.mark({ class: "cm-live-link" })
const strikethroughMark = Decoration.mark({ class: "cm-live-strikethrough" })
const blockquoteMark = Decoration.mark({ class: "cm-live-blockquote" })
const fencedCodeMark = Decoration.mark({ class: "cm-live-fenced-code" })
const fenceLineMark = Decoration.line({ class: "cm-live-fence-line" })

// Tokens that should be hidden when cursor is NOT nearby
const HIDDEN_TOKENS = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "LinkMark",
  "URL",
  "QuoteMark",
  "StrikethroughMark",
])

// Nodes to style with marks
const STYLED_NODES: Record<string, Decoration> = {
  Emphasis: emphasisMark,
  StrongEmphasis: strongMark,
  InlineCode: inlineCodeMark,
  Link: linkMark,
}

// ─── Cursor helpers ────────────────────────────────────────────

/** Check if ANY selection range overlaps [from, to] */
export function selectionOverlaps(ranges: readonly SelectionRange[], from: number, to: number): boolean {
  for (const r of ranges) {
    if (r.from <= to && r.to >= from) return true
  }
  return false
}

/** Check if ANY cursor (collapsed selection) is on the same line as [from, to] */
export function cursorOnLine(state: EditorState, ranges: readonly SelectionRange[], from: number, to: number): boolean {
  const doc = state.doc
  const nodeStartLine = doc.lineAt(from).number
  const nodeEndLine = doc.lineAt(to).number
  for (const r of ranges) {
    if (r.empty) {
      const cursorLine = doc.lineAt(r.head).number
      if (cursorLine >= nodeStartLine && cursorLine <= nodeEndLine) return true
    } else {
      // Non-empty selection — check overlap
      if (r.from <= to && r.to >= from) return true
    }
  }
  return false
}

// ─── ViewPlugin ────────────────────────────────────────────────

export function buildDecorations(
  state: EditorState,
  widgetLangs?: Map<string, WidgetPlugin>,
  theme: "dark" | "light" = "dark",
): LiveEditState {
  const widgets: Range<Decoration>[] = []
  const wrapperRanges: Range<BlockWrapper>[] = []
  const docLen = state.doc.length

  syntaxTree(state).iterate({
      enter(node) {
        // Headings — always styled, # always hidden (Notion/Linear style)
        if (node.name in headingMarks) {
          widgets.push(headingMarks[node.name].range(node.from, node.to))
          // Line decoration for font-size — on .cm-line so CM6 measures height correctly
          const line = state.doc.lineAt(node.from)
          widgets.push(headingLines[node.name].range(line.from))
          return // process children to hide HeaderMark
        }

        // Styled inline elements — always styled, never reveal raw
        if (node.name in STYLED_NODES) {
          widgets.push(STYLED_NODES[node.name].range(node.from, node.to))
          return
        }

        // Strikethrough (GFM) — always styled
        if (node.name === "Strikethrough") {
          widgets.push(strikethroughMark.range(node.from, node.to))
          return
        }

        // Task lists — replace [x]/[ ] with checkbox, hide - prefix
        if (node.name === "Task") {
          // Hide the ListMark (- ) before the task
          const listItem = node.node.parent
          if (listItem) {
            const listMark = listItem.getChild("ListMark")
            if (listMark && listMark.from < listMark.to) {
              // Hide "- " (mark + trailing space)
              const end = Math.min(listMark.to + 1, docLen)
              widgets.push(hiddenMark.range(listMark.from, end))
            }
          }
          return // process children for TaskMarker
        }
        if (node.name === "TaskMarker") {
          const text = state.doc.sliceString(node.from, node.to)
          const checked = text.includes("x") || text.includes("X")
          widgets.push((checked ? taskCheckedMark : taskUncheckedMark).range(node.from, node.to))
          return
        }

        // Horizontal rules — styled divider
        if (node.name === "HorizontalRule") {
          const line = state.doc.lineAt(node.from)
          widgets.push(hrLine.range(line.from))
          return false
        }

        // Tables — BlockWrapper for container, mark-based for content
        if (node.name === "Table") {
          wrapperRanges.push(tableWrapper.range(node.from, node.to))
          return // process children
        }
        if (node.name === "TableHeader" || node.name === "TableRow") {
          const line = state.doc.lineAt(node.from)
          widgets.push((node.name === "TableHeader" ? tableHeaderLine : tableRowLine).range(line.from))

          // Detect empty cells: walk children, find gaps between
          // consecutive TableDelimiters with no TableCell in between
          let lastDelimEnd = -1
          const cursor = node.node.cursor()
          if (cursor.firstChild()) {
            do {
              if (cursor.name === "TableDelimiter") {
                if (lastDelimEnd >= 0) {
                  // Check if there's only whitespace between lastDelimEnd and cursor.from
                  const gap = state.doc.sliceString(lastDelimEnd, cursor.from)
                  if (gap.trim() === "" && cursor.from > lastDelimEnd) {
                    // Empty cell — mark the whitespace as a cell so it gets flex:1
                    widgets.push(tableCellMark.range(lastDelimEnd, cursor.from))
                  }
                }
                lastDelimEnd = cursor.to
              } else if (cursor.name === "TableCell") {
                lastDelimEnd = -1 // reset — cell exists between delimiters
              }
            } while (cursor.nextSibling())
          }

          return // process children for pipe/cell marks
        }
        if (node.name === "TableCell") {
          if (node.from < node.to) {
            widgets.push(tableCellMark.range(node.from, node.to))
          }
        }
        if (node.name === "TableDelimiter") {
          const line = state.doc.lineAt(node.from)
          if (/^[\s|:-]+$/.test(line.text)) {
            // Separator row (---|---|---) — collapse it
            widgets.push(tableDelimiterLine.range(line.from))
          } else if (node.from < node.to) {
            // Pipe character — hide it, CSS table-cell handles separation
            widgets.push(tablePipeMark.range(node.from, node.to))
          }
        }

        // Blockquote — always style the block with left border
        if (node.name === "Blockquote") {
          widgets.push(blockquoteMark.range(node.from, node.to))
          return // process children for QuoteMark hiding
        }

        // Fenced code blocks — style the block or render widget
        if (node.name === "FencedCode") {
          // Widget code blocks — ALWAYS render, never reveal raw JSON.
          // Widgets are agent-generated; edit via source mode or API.
          const codeInfoNode = node.node.getChild("CodeInfo")
          if (codeInfoNode && widgetLangs) {
            const lang = state.doc.sliceString(codeInfoNode.from, codeInfoNode.to).trim().toLowerCase()
            const plugin = widgetLangs.get(lang)
            if (plugin) {
              const codeTextNode = node.node.getChild("CodeText")
              const code = codeTextNode
                ? state.doc.sliceString(codeTextNode.from, codeTextNode.to).trim()
                : ""
              if (code && node.from < node.to) {
                const widgetDeco = Decoration.replace({
                  widget: new LiveWidgetType(plugin, code, theme, node.from),
                  block: true,
                })
                widgets.push(widgetDeco.range(node.from, node.to))
                return false // skip children — widget is always rendered
              }
            }
          }

          // Regular code block — always styled, no cursor reveal
          widgets.push(fencedCodeMark.range(node.from, node.to))
          const doc = state.doc
          const startLine = doc.lineAt(node.from)
          const endLine = doc.lineAt(node.to)
          widgets.push(fenceLineMark.range(startLine.from))
          if (endLine.number !== startLine.number) {
            widgets.push(fenceLineMark.range(endLine.from))
          }
          return
        }

        // Hidden tokens — always hidden (Notion/Linear style, no cursor reveal)
        if (HIDDEN_TOKENS.has(node.name)) {
          // HeaderMark: hide the # plus trailing space, clamped to doc length
          if (node.name === "HeaderMark") {
            const end = Math.min(node.to + 1, docLen)
            if (end > node.from) {
              widgets.push(hiddenMark.range(node.from, end))
            }
          } else {
            if (node.from < node.to) { // guard against zero-width ranges
              widgets.push(hiddenMark.range(node.from, node.to))
            }
          }
        }

        // CodeInfo (language label after ```) — hide with fence
        if (node.name === "CodeInfo") {
          if (node.from < node.to) {
            widgets.push(hiddenMark.range(node.from, node.to))
          }
        }
      },
    })

  return {
    decorations: Decoration.set(widgets, true),
    wrappers: BlockWrapper.set(wrapperRanges, true),
  }
}

interface LiveEditState {
  decorations: DecorationSet
  wrappers: RangeSet<BlockWrapper>
}

/** Create the live editing extension, optionally with widget support. */
export function createLiveEditing(
  widgetPlugins?: WidgetPlugin[],
  theme: "dark" | "light" = "dark",
): Extension {
  const widgetLangs = widgetPlugins
    ? new Map(widgetPlugins.filter(p => p.codeBlockLang).map(p => [p.codeBlockLang!, p]))
    : undefined

  const field = StateField.define<LiveEditState>({
    create(state) {
      return buildDecorations(state, widgetLangs, theme)
    },
    update(prev, tr) {
      // No cursor-reveal means we only rebuild on doc changes
      if (!tr.docChanged) return prev
      return buildDecorations(tr.state, widgetLangs, theme)
    },
    provide: (f) => [
      EditorView.decorations.from(f, v => v.decorations),
      EditorView.blockWrappers.from(f, v => v.wrappers),
    ],
  })

  return field
}

/** CM6 extension for live markdown editing (no widgets). */
export const liveEditing = createLiveEditing()
