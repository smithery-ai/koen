/**
 * CM6 WidgetType for rendering markdown tables as HTML tables in live mode.
 * Same pattern as LiveWidgetType — always rendered, edit via source mode.
 */

import { WidgetType, EditorView } from "@codemirror/view"

function simpleHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function parseCells(line: string): string[] {
  // Split by pipe, trim, drop leading/trailing empty segments from outer pipes
  const parts = line.split("|").map(c => c.trim())
  // Remove first if empty (leading |) and last if empty (trailing |)
  if (parts.length > 0 && parts[0] === "") parts.shift()
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop()
  return parts
}

export class LiveTableWidget extends WidgetType {
  private hash: number

  constructor(readonly tableText: string) {
    super()
    this.hash = simpleHash(tableText)
  }

  eq(other: LiveTableWidget): boolean {
    return this.hash === other.hash
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div")
    container.className = "cm-live-table"

    const lines = this.tableText.split("\n").filter(l => l.trim())
    if (lines.length < 2) {
      container.textContent = this.tableText
      return container
    }

    const headers = parseCells(lines[0])
    const table = document.createElement("table")

    const thead = document.createElement("thead")
    const hr = document.createElement("tr")
    for (const h of headers) {
      const th = document.createElement("th")
      th.innerHTML = renderInline(h)
      hr.appendChild(th)
    }
    thead.appendChild(hr)
    table.appendChild(thead)

    const tbody = document.createElement("tbody")
    // Skip delimiter row (line 1), process body rows
    for (let i = 2; i < lines.length; i++) {
      const cells = parseCells(lines[i])
      const tr = document.createElement("tr")
      for (let j = 0; j < headers.length; j++) {
        const td = document.createElement("td")
        td.innerHTML = renderInline(cells[j] || "")
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    container.appendChild(table)

    requestAnimationFrame(() => view.requestMeasure())
    return container
  }

  get estimatedHeight(): number { return 80 }
  ignoreEvent(): boolean { return false }
}
