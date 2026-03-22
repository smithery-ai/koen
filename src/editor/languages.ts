import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import type { Extension } from "@codemirror/state"

// Markdown is always sync — it's the live editing language
export function getLanguage(filename?: string): Extension[] {
  const ext = filename?.split(".").pop()?.toLowerCase()
  if (ext === "md" || ext === "mdx" || ext === "markdown") {
    return [markdown({ extensions: GFM })]
  }
  return []
}

// Non-markdown languages loaded on demand
export async function getLanguageAsync(filename?: string): Promise<Extension[]> {
  const ext = filename?.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "js": case "jsx": case "ts": case "tsx": {
      const { javascript } = await import("@codemirror/lang-javascript")
      return [javascript({ jsx: true, typescript: ext.includes("ts") })]
    }
    case "py": { const { python } = await import("@codemirror/lang-python"); return [python()] }
    case "rs": { const { rust } = await import("@codemirror/lang-rust"); return [rust()] }
    case "css": { const { css } = await import("@codemirror/lang-css"); return [css()] }
    case "html": { const { html } = await import("@codemirror/lang-html"); return [html()] }
    case "json": { const { json } = await import("@codemirror/lang-json"); return [json()] }
    case "md": case "mdx": case "markdown": return [markdown({ extensions: GFM })]
    default: return []
  }
}
