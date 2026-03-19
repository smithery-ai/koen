---
name: koen-widget
description: Create custom widget plugins for the koen editor library. Use when building new widget types for markdown preview — charts, diagrams, embeds, visualizations, or any interactive content rendered inside fenced code blocks. Triggers on "create widget", "new widget", "add widget", "widget plugin", "koen widget", "custom code block", or when adding a new visualization type to koen's markdown preview.
---

# Creating koen Widget Plugins

koen widgets are imperative DOM hydrators dispatched by fenced code block language. The code block language tag is the routing key, the hydrator receives an `HTMLElement` to render into.

## WidgetPlugin Interface

```ts
import type { WidgetPlugin } from "koen"

const myPlugin: WidgetPlugin = {
  type: "my-widget",           // Widget type identifier
  codeBlockLang: "my-widget",  // Optional: ```my-widget routes here
  toSpec: (text, position) => ({ ... }),  // Optional: convert code block text to spec
  hydrate: (container, spec, theme) => {  // Render into container
    // container: empty HTMLElement to render into
    // spec: { widgetId, type, ...your fields }
    // theme: "dark" | "light"
    return () => { /* cleanup */ }  // optional cleanup function
  },
}
```

## How It Works

1. User writes a fenced code block with the plugin's `codeBlockLang`
2. `parseWithPositions` converts it to `<div data-widget-spec="...">` placeholder
3. `hydrateWidgets` finds placeholders and calls the matching `hydrate` function
4. On content/theme change, cleanup runs, then hydration re-runs

## Spec Resolution

- If `toSpec` is defined: called with `(rawText, startPosition)`, result merged into `{ widgetId, type, ...result }`
- If `toSpec` is omitted: code block text is parsed as JSON and merged into spec
- The generic ` ```widget ` language always works (raw JSON with explicit `type` field)

## Patterns

### Simple synchronous widget

```ts
export const tablePlugin: WidgetPlugin = {
  type: "csv-table",
  codeBlockLang: "csv",
  toSpec: (text) => ({ data: text }),
  hydrate: (container, spec) => {
    const rows = spec.data.split("\n").filter(Boolean)
    const table = document.createElement("table")
    for (const row of rows) {
      const tr = document.createElement("tr")
      for (const cell of row.split(",")) {
        const td = document.createElement("td")
        td.textContent = cell.trim()
        tr.appendChild(td)
      }
      table.appendChild(tr)
    }
    container.innerHTML = ""
    container.appendChild(table)
  },
}
```

### Async widget with CDN loading

Use the shared `loadCDN(url, globalName)` helper from `src/utils.ts`:

```ts
import type { WidgetPlugin } from "../types"
import { loadCDN } from "../utils"

const CDN_URL = "https://cdn.jsdelivr.net/npm/my-lib@1/dist/my-lib.min.js"

export const myLibPlugin: WidgetPlugin = {
  type: "my-lib",
  codeBlockLang: "my-lib",
  toSpec: (text) => ({ config: text }),
  hydrate: (container, spec, theme) => {
    container.innerHTML = ""
    let disposed = false  // CRITICAL: prevents stale DOM mutation after cleanup

    loadCDN(CDN_URL, "MyLib")
      .then(() => {
        if (disposed) return
        ;(window as any).MyLib.render(container, spec.config)
      })
      .catch((err: Error) => {
        if (disposed) return
        container.textContent = `Failed: ${err.message}`
      })

    return () => { disposed = true }
  },
}
```

## Registration

Pass widgets as props to `<Editor>`:

```tsx
import { Editor, chartPlugin, mermaidPlugin } from "koen"
import { myPlugin } from "./myPlugin"

<Editor widgets={[chartPlugin, mermaidPlugin, myPlugin]} content={code} />
```

No `widgets` prop = defaults to `[chartPlugin, mermaidPlugin, diffPlugin, globePlugin]`.

## File Location & Naming

Place in `src/widgets/{Name}Widget.ts`. Export as `{name}Plugin`. Add export to `src/index.ts`.

## Checklist

- [ ] Export a `WidgetPlugin` object (not a side-effect registration)
- [ ] Set `codeBlockLang` if the widget should have its own code block language
- [ ] Set `toSpec` if code block content is not JSON (e.g. raw text, diagram syntax)
- [ ] Return cleanup from `hydrate` for event listeners, timers, or async resources
- [ ] Use `disposed` flag for async hydrators to prevent stale DOM mutations
- [ ] Handle both `"dark"` and `"light"` themes
- [ ] Clear `container.innerHTML` before appending
- [ ] Add CSS to `src/styles/koen.css` with `.koen-` prefix if needed
- [ ] Export from `src/index.ts`
- [ ] Add to `_defaults` array in `src/widgets/registry.ts` if it should be included by default
- [ ] Use `loadCDN()` from `src/utils.ts` for CDN-loaded libraries (not manual script injection)
