/** Shared constants and utilities used across components. */

export const COMMENT_COLORS = ["#C15F3C", "#7aa874", "#6a8ac0", "#c4a050", "#a070b0", "#c07070", "#50a0a0", "#b08050"]

const units: [number, string][] = [[86400, "d"], [3600, "h"], [60, "m"]]

export function getTimeAgo(isoStr: string): string {
  if (!isoStr) return ""
  const ts = isoStr.endsWith("Z") || isoStr.includes("+") ? isoStr : isoStr + "Z"
  const secs = (Date.now() - new Date(ts).getTime()) / 1000

  for (const [threshold, label] of units) {
    if (secs >= threshold) return `${Math.floor(secs / threshold)}${label} ago`
  }
  return "just now"
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Lazy-load a script from CDN. Caches the promise and checks for a global before loading. */
export function loadCDN(url: string, globalName: string): Promise<void> {
  const key = `__cdn_${globalName}`
  if ((window as any)[key]) return (window as any)[key]
  if ((window as any)[globalName]) {
    return ((window as any)[key] = Promise.resolve())
  }
  return ((window as any)[key] = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = url
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${globalName}`))
    document.head.appendChild(s)
  }))
}
