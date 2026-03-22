import { describe, it, expect } from "vitest"
import { getLanguage, getLanguageAsync } from "./languages"

describe("getLanguage (sync — markdown only)", () => {
  it("returns markdown for .md", () => {
    expect(getLanguage("README.md")).toHaveLength(1)
  })

  it("returns markdown for .mdx", () => {
    expect(getLanguage("doc.mdx")).toHaveLength(1)
  })

  it("returns empty for non-markdown files (loaded async)", () => {
    expect(getLanguage("file.js")).toEqual([])
    expect(getLanguage("file.py")).toEqual([])
    expect(getLanguage("file.rs")).toEqual([])
  })

  it("returns empty array for unknown extensions", () => {
    expect(getLanguage("file.xyz")).toEqual([])
    expect(getLanguage("file.txt")).toEqual([])
  })

  it("returns empty array for undefined", () => {
    expect(getLanguage(undefined)).toEqual([])
  })
})

describe("getLanguageAsync (all languages)", () => {
  it("returns javascript for .js/.jsx/.ts/.tsx", async () => {
    for (const ext of ["js", "jsx", "ts", "tsx"]) {
      const result = await getLanguageAsync(`file.${ext}`)
      expect(result).toHaveLength(1)
    }
  })

  it("returns python for .py", async () => {
    expect(await getLanguageAsync("script.py")).toHaveLength(1)
  })

  it("returns rust for .rs", async () => {
    expect(await getLanguageAsync("main.rs")).toHaveLength(1)
  })

  it("returns markdown for .md", async () => {
    expect(await getLanguageAsync("README.md")).toHaveLength(1)
  })

  it("returns css for .css", async () => {
    expect(await getLanguageAsync("styles.css")).toHaveLength(1)
  })

  it("returns json for .json", async () => {
    expect(await getLanguageAsync("package.json")).toHaveLength(1)
  })

  it("returns html for .html", async () => {
    expect(await getLanguageAsync("index.html")).toHaveLength(1)
  })

  it("returns empty array for unknown extensions", async () => {
    expect(await getLanguageAsync("file.xyz")).toEqual([])
  })
})
