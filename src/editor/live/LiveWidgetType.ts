/**
 * CM6 WidgetType for rendering engei widgets inline in live editing mode.
 *
 * Uses Decoration.replace({block: true}) to replace fenced code blocks
 * with rendered widgets (charts, mermaid, maps, etc.) when cursor is away.
 *
 * Key design decisions (from council review):
 * - eq() compares type + code hash to prevent unnecessary toDOM() calls
 * - Spec/promise caching at module level (not DOM caching — DOM is disposable)
 * - requestMeasure() after async hydration for height updates
 * - destroy() calls widget cleanup functions
 */

import { WidgetType, EditorView } from "@codemirror/view"
import type { WidgetPlugin, WidgetSpec } from "engei-widgets"

// ─── Spec cache ─────────────────────────────────────────────
// Cache parsed specs so we don't re-parse on every decoration rebuild
const specCache = new Map<string, WidgetSpec>()

function getSpec(plugin: WidgetPlugin, code: string, position: number): WidgetSpec | null {
  const key = `${plugin.type}:${code}`
  const cached = specCache.get(key)
  if (cached) return cached

  try {
    let specData: Record<string, any>
    if (plugin.toSpec) {
      specData = plugin.toSpec(code, position)
    } else {
      specData = JSON.parse(code)
    }
    const spec: WidgetSpec = {
      widgetId: `${plugin.type}-live-${position}`,
      type: plugin.type,
      ...specData,
    }
    specCache.set(key, spec)
    return spec
  } catch {
    return null
  }
}

// ─── Simple hash for eq() ───────────────────────────────────

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

// ─── WidgetType ─────────────────────────────────────────────

export class LiveWidgetType extends WidgetType {
  private codeHash: number
  private cleanup: (() => void) | null = null

  constructor(
    readonly plugin: WidgetPlugin,
    readonly code: string,
    readonly theme: "dark" | "light",
    readonly position: number,
  ) {
    super()
    this.codeHash = simpleHash(code)
  }

  eq(other: LiveWidgetType): boolean {
    return this.plugin.type === other.plugin.type
      && this.codeHash === other.codeHash
      && this.theme === other.theme
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div")
    container.className = "cm-live-widget"
    container.setAttribute("data-widget-type", this.plugin.type)

    const spec = getSpec(this.plugin, this.code, this.position)
    if (!spec) {
      container.textContent = `${this.plugin.type} widget`
      container.style.opacity = "0.5"
      container.style.padding = "12px"
      return container
    }

    // Defer hydration — don't block LCP with CDN script loads
    const hydrate = () => {
      const result = this.plugin.hydrate(container, spec, this.theme)
      if (typeof result === "function") {
        this.cleanup = result
      }
      requestAnimationFrame(() => view.requestMeasure())
    }

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(hydrate, { timeout: 2000 })
    } else {
      setTimeout(hydrate, 100)
    }

    return container
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    // If eq() returned false but we get here, the code or theme changed.
    // Re-hydrate into the same container.
    if (this.cleanup) {
      this.cleanup()
      this.cleanup = null
    }

    dom.innerHTML = ""
    const spec = getSpec(this.plugin, this.code, this.position)
    if (!spec) return false

    const result = this.plugin.hydrate(dom, spec, this.theme)
    if (typeof result === "function") {
      this.cleanup = result
    }

    requestAnimationFrame(() => {
      view.requestMeasure()
    })

    return true
  }

  get estimatedHeight(): number {
    return 200 // reasonable default for charts/diagrams
  }

  destroy(dom: HTMLElement): void {
    if (this.cleanup) {
      this.cleanup()
      this.cleanup = null
    }
  }

  ignoreEvent(): boolean {
    return true // widget is inert — clicks don't move cursor
  }
}
