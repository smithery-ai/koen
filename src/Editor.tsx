/**
 * Editor — standalone code editor with inline comments.
 * Pure UI component: props in, callbacks out.
 */

import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react"
import type { EditorView } from "@codemirror/view"
import CodeMirrorEditor from "./editor/CodeMirrorEditor"
import CommentPill from "./comments/CommentPill"
import CommentMargin from "./comments/CommentMargin"
import MarkdownPreview from "./preview/MarkdownPreview"
import { createAnchor } from "./comments/anchoring"
import type { EditorProps } from "./types"

export interface EditorHandle {
  /** Get the current document content */
  getContent: () => string
  /** Focus the editor */
  focus: () => void
  /** Get the underlying CodeMirror EditorView (source mode only) */
  getView: () => EditorView | null
}

export default forwardRef<EditorHandle, EditorProps>(function Editor({
  content,
  filename = "",
  readOnly = false,
  mode = "source",
  comments = [],
  activeCommentId = null,
  commentsVisible = true,
  theme = "dark",
  className = "",
  onChange,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onAddReply,
  onActiveCommentChange,
  onLinkClick,
  widgets,
}, ref) {
  const [view, setView] = useState<EditorView | null>(null)
  const isDark = theme === "dark"
  const contentRef = useRef(content)
  contentRef.current = content

  useImperativeHandle(ref, () => ({
    getContent: () => contentRef.current,
    focus: () => view?.focus(),
    getView: () => view,
  }), [view])

  const handleSourceComment = useCallback((from: number, to: number) => {
    if (!onCreateComment) return
    const doc = view?.state.doc.toString() || content
    onCreateComment(createAnchor(doc, from, to))
  }, [view, content, onCreateComment])

  const handleSubmitBody = useCallback((commentId: string, body: string) => {
    onUpdateComment?.(commentId, body)
  }, [onUpdateComment])

  const handlePreviewAddComment = useCallback((anchor: any, body: string) => {
    if (body === "") {
      onCreateComment?.(anchor)
    } else {
      // Preview draft submission — find the comment and update it
      const comment = comments.find(c => c.anchor.exact === anchor.exact && c.anchor.hint === anchor.hint && !c.body)
      if (comment) {
        onUpdateComment?.(comment.id, body)
      } else {
        // Preview submits anchor+body in one shot (draft was local to MarkdownPreview).
        // Pass body to onCreateComment so FolderView can create + persist.
        onCreateComment?.(anchor, body)
      }
    }
  }, [onCreateComment, onUpdateComment, comments])

  const handleActiveChange = useCallback((id: string | null) => {
    onActiveCommentChange?.(id)
  }, [onActiveCommentChange])

  if (mode === "preview") {
    return (
      <div className={`koen-editor ${className}`.trim()} data-theme={theme}>
        <div className="editor-container preview-scroll">
          <MarkdownPreview
            content={content}
            comments={comments}
            commentsVisible={commentsVisible}
            theme={theme}
            widgets={widgets}
            onAddComment={handlePreviewAddComment}
            onDeleteComment={onDeleteComment}
            onAddReply={(commentId, body) => onAddReply?.(commentId, body)}
            onLinkClick={onLinkClick}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`koen-editor ${className}`.trim()} data-theme={theme}>
      <div className="editor-main">
        <div className="editor-container" style={{ position: "relative" }}>
          <CodeMirrorEditor
            content={content}
            filename={filename}
            readOnly={readOnly}
            isDark={isDark}
            comments={comments}
            onChange={onChange}
            onViewReady={setView}
            onViewDestroy={() => setView(null)}
          />
          {commentsVisible && view && (
            <CommentPill view={view} onComment={handleSourceComment} />
          )}
        </div>
        {commentsVisible && comments.length > 0 && (
          <CommentMargin
            view={view}
            comments={comments}
            content={content}
            activeCommentId={activeCommentId}
            onActiveCommentChange={handleActiveChange}
            onDeleteComment={onDeleteComment}
            onSubmitBody={handleSubmitBody}
            onAddReply={(commentId, body) => onAddReply?.(commentId, body)}
          />
        )}
      </div>
    </div>
  )
})
