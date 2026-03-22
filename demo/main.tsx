import { useState } from "react"
import { createRoot } from "react-dom/client"
import { Editor, getDefaultWidgets } from "../src/index"
import "../src/styles/engei.css"

const widgets = getDefaultWidgets()

const SAMPLE_MD = `# China Trip — April 2026

## Wedding Venue

\`\`\`map
{"zoom":11,"center":[39.97,116.50],"markers":[{"location":[40.08,116.59],"label":"Beijing Capital Intl (PEK)","color":"#C15F3C"},{"location":[39.93,116.46],"label":"Wedding — 正院公馆","color":"#7aa874"},{"location":[39.95,116.42],"label":"Nostalgia Hotel Yonghe Lama","color":"#6a8ac0"}],"height":"400px"}
\`\`\`

---

## Calendar

\`\`\`calendar
{"month":"2026-04","events":[{"start":"2026-04-03","end":"2026-04-03","title":"✈ SIN → PEK","color":"#6a8ac0"},{"start":"2026-04-04","end":"2026-04-04","title":"Wedding Day","color":"#7aa874"},{"start":"2026-04-05","end":"2026-04-07","title":"Beijing","color":"#c9a87c"},{"start":"2026-04-08","end":"2026-04-08","title":"✈ PEK → SIN","color":"#c15f3c"}]}
\`\`\`

### Hotel

**[Nostalgia Hotel Beijing Yonghe Lama](https://www.booking.com/hotel/cn/nostalgia-beijing-yonghe-lama-temple.html?checkin=2026-04-03&checkout=2026-04-07)**

| | |
|---|---|
| **Rating** | 8.6 (Booking.com) |
| **Check-in** | Thu 3 Apr |
| **Check-out** | Mon 7 Apr |
| **Nights** | 4 |
| **Price** | ~S$320 total (~S$80/night) |
| **Area** | Dongcheng, near Lama Temple & Wudaoying Hutong |
| **Metro** | Yonghegong station (Lines 2 & 5) |

---

## Day-by-Day Itinerary

### Day 1 — Thu 3 Apr

**Travel Day: Singapore → Beijing**

| | |
|---|---|
| **16:40** | Depart Singapore Changi T3 — SQ 806 |
| **23:00** | Arrive Beijing Capital Intl T3 |

**Airport → Hotel options:**

| Option | Time | Cost | Notes |
|---|---|---|---|
| Night shuttle bus | ~40 min | ¥25 (~S$5) | Direct to Yonghegong |
| Taxi | 45-60 min | ¥100-160 (~S$20-30) | Easier with heavy luggage |
| Airport Express metro | 20 min | ¥30 (~S$6) | Last train ~22:30-23:00 |

Check in to Nostalgia Hotel Yonghe Lama and rest up.

---

### Day 2 — Sat 4 Apr

**Liyen & Henry's Wedding**

| Time | Event | Details |
|---|---|---|
| **3:30 PM** | Guests arrive | Settle down and mingle at 正院公馆 |
| **4:00 PM** | Official Ceremony | Intimate vows in a Chinese garden |
| **4:30 PM** | Tea Ceremony + Cocktails | Honor the elders, sip tea |
| **6:00 PM** | Dinner Reception | Dinner, drinks, and dancing |

| | |
|---|---|
| **Venue** | 正院公馆 (Zheng Yuan Gong Guan) |
| **Address** | Dongfeng S Rd, Chaoyang, Beijing |
| **Dress code** | Formal |

---

## Checklist

- [x] Book hotel
- [ ] Dry wash suit
- [ ] Book Badaling train tickets (by Mar 23!)
- [ ] Book Forbidden City tickets

---

> **Passenger:** Mr Arjun Kumar Muthukumar

_

const OLD_SAMPLE = \`# Welcome to Live Editing

This is a **bold** statement and an *italic* one. Here's some ***bold italic*** text.

## Features

You can write \`inline code\` and ~~strikethrough~~ text.

Here's a [link to example](https://example.com) in the middle of text.

> This is a blockquote. It should have a nice left border
> and proper indentation.

\`\`\`typescript
function greet(name: string) {
  console.log(\`Hello, \${name}!\`)
}
\`\`\`

### Table Example

| Feature | Status | Notes |
|---------|--------|-------|
| **Headings** | Done | h1-h6 styled |
| *Inline* | Done | bold, italic, code |
| Links | Done | URL hidden |
| Tables | New | You're looking at it |

### Stress Test Table

| Time | Event | Details | Status |
|---|---|---|---|
| **3:30 PM** | Guests arrive | Settle down and mingle | Confirmed |
| **4:00 PM** | Ceremony | Intimate vows in a garden. [More info](https://example.com) | Confirmed |
| **6:00 PM** | Dinner | Dinner, drinks, and \`dancing\` | Pending |
| | Empty first cell | This row starts empty | |

### Torture Test Table

| A | B |
|---|---|
| One | Two |

| Single column |
|---|
| Just one |
| Another |

| Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 |
|---|---|---|---|---|---|
| a | b | c | d | e | f |
| **bold** | *italic* | \`code\` | [link](url) | ~~struck~~ | normal |
| This cell has a much longer text that should wrap properly within the column | short | x | | | last |

### Chart Widget

\`\`\`chart
{
  "config": {
    "type": "bar",
    "data": {
      "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "datasets": [{ "label": "Commits", "data": [12, 19, 3, 5, 8] }]
    }
  }
}
\`\`\`

### Another heading

Some more text after the heading. **Bold with *nested italic* inside**.

Normal paragraph to end.
`

function App() {
  const [content, setContent] = useState(SAMPLE_MD)
  const [mode, setMode] = useState<"source" | "preview" | "live">("live")
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="toolbar">
        <button className={mode === "source" ? "active" : ""} onClick={() => setMode("source")}>Source</button>
        <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>Live</button>
        <button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>Preview</button>
        <select value={theme} onChange={e => setTheme(e.target.value as "dark" | "light")}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
      <div id="editor-root" style={{ flex: 1, minHeight: 0 }}>
        <Editor
          content={content}
          filename="demo.md"
          mode={mode}
          theme={theme}
          widgets={widgets}
          onChange={setContent}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
