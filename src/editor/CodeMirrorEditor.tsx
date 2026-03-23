/**
 * Controlled CodeMirror 6 editor component.
 * Accepts content as a prop, emits onChange.
 * Uses Compartments for readOnly/theme to avoid full editor rebuilds.
 */

import { useEffect, useRef, useCallback } from "react"
import { EditorView, basicSetup } from "codemirror"
import { EditorState, Compartment } from "@codemirror/state"
import { buildSonoTheme, getSyntaxHighlighting } from "./theme"
import { getLanguage, getLanguageAsync } from "./languages"
import { commentField, setComments } from "../comments/CommentDecoration"
import { resolveAnchor } from "../comments/anchoring"
import { createLiveEditing } from "./live/liveEditing"
import type { Comment } from "../types"
import type { WidgetPlugin } from "engei-widgets"

interface Props {
  content: string
  filename?: string
  readOnly?: boolean
  isDark: boolean
  comments: Comment[]
  liveMode?: boolean
  widgets?: WidgetPlugin[]
  onChange?: (content: string) => void
  onViewReady?: (view: EditorView) => void
  onViewDestroy?: () => void
}

export default function CodeMirrorEditor({
  content,
  filename,
  readOnly = false,
  isDark,
  comments,
  liveMode = false,
  widgets,
  onChange,
  onViewReady,
  onViewDestroy,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const suppressChangeRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Compartments for reconfigurable extensions
  const readOnlyComp = useRef(new Compartment())
  const themeComp = useRef(new Compartment())
  const syntaxComp = useRef(new Compartment())
  const langComp = useRef(new Compartment())

  // Create/destroy editor when filename changes (language requires rebuild)
  useEffect(() => {
    if (!containerRef.current) return

    viewRef.current?.destroy()

    const extensions = [
      basicSetup,
      themeComp.current.of(buildSonoTheme(isDark)),
      syntaxComp.current.of(getSyntaxHighlighting(isDark)),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
      langComp.current.of(getLanguage(filename)),
      commentField,
      readOnlyComp.current.of(EditorState.readOnly.of(readOnly)),
      ...(liveMode ? [createLiveEditing(widgets, isDark ? "dark" : "light")] : []),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !suppressChangeRef.current) {
          onChangeRef.current?.(update.state.doc.toString())
        }
      }),
    ]

    const state = EditorState.create({ doc: content, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    onViewReady?.(view)

    // Async-load non-markdown languages into the compartment
    if (getLanguage(filename).length === 0 && filename) {
      getLanguageAsync(filename).then(lang => {
        if (viewRef.current === view && lang.length > 0) {
          view.dispatch({ effects: langComp.current.reconfigure(lang) })
        }
      })
    }

    return () => {
      view.destroy()
      viewRef.current = null
      onViewDestroy?.()
    }
    // Rebuild on filename change (language requires new parser), liveMode toggle,
    // or theme change in live mode (widgets bake theme colors into DOM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, liveMode, liveMode && isDark])

  // Reconfigure readOnly via compartment (no rebuild)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: readOnlyComp.current.reconfigure(EditorState.readOnly.of(readOnly)) })
  }, [readOnly])

  // Reconfigure theme via compartment (no rebuild)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        themeComp.current.reconfigure(buildSonoTheme(isDark)),
        syntaxComp.current.reconfigure(getSyntaxHighlighting(isDark)),
      ],
    })
  }, [isDark])

  // Sync controlled content prop -> CM6 doc
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (content === currentDoc) return

    suppressChangeRef.current = true
    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: content },
    })
    suppressChangeRef.current = false
  }, [content])

  // Sync comments -> CM6 decorations
  const syncComments = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc.toString()
    const resolved = comments
      .map(c => {
        const range = resolveAnchor(doc, c.anchor)
        return range ? { id: c.id, from: range.from, to: range.to } : null
      })
      .filter((r): r is { id: string; from: number; to: number } => r !== null)

    view.dispatch({ effects: setComments.of(resolved) })
  }, [comments])

  useEffect(() => {
    syncComments()
  }, [syncComments])

  return <div ref={containerRef} className={`koen-editor-cm${liveMode ? " koen-editor-live" : ""}`} data-readonly={readOnly || undefined} />
}
