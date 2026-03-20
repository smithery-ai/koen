/**
 * Markdown preview with comment support.
 * Uses ref-based innerHTML (React doesn't own the preview div).
 * Highlight ranges are computed via useMemo from props, applied imperatively.
 */

import { useEffect, useRef, useMemo, useState, useCallback, useLayoutEffect, forwardRef } from "react"
import Avatar from "boring-avatars"
import { renderMarkdown } from "../sanitize"

import { parseWithPositions, clearHighlights } from "./markedPositions"
import { useTextSelection } from "./useTextSelection"
import { createAnchor as createAnchorFn, resolveAnchor } from "../comments/anchoring"
import { computePopoverPositions } from "../comments/popoverPositioning"
import { resolveCollisions } from "../comments/resolveCollisions"
import { applyHighlights } from "./usePreviewHighlights"
import { hydrateWidgets, buildWidgetRegistry, buildLangMap, getDefaultWidgets } from "engei-widgets"
import type { Comment, Anchor, WidgetPlugin } from "../types"
import { COMMENT_COLORS, getTimeAgo } from "../utils"

interface Props {
  content: string
  comments: Comment[]
  commentsVisible: boolean
  theme?: "dark" | "light"
  widgets?: WidgetPlugin[]
  onAddComment: (anchor: Anchor, body: string) => void
  onDeleteComment: (id: string) => void
  onAddReply: (commentId: string, body: string) => void
  onLinkClick?: (href: string) => void
}

export default function MarkdownPreview({
  content,
  comments,
  commentsVisible,
  theme = "dark",
  widgets,
  onAddComment,
  onDeleteComment,
  onAddReply,
  onLinkClick,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const lastHtmlRef = useRef<string>("")
  const lastThemeRef = useRef<string>("")
  const [commentPositions, setCommentPositions] = useState<{ commentId: string; top: number }[]>([])
  const [draftComment, setDraftComment] = useState<{ from: number; to: number; top: number } | null>(null)
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  // popoverHoveredId is managed imperatively via updatePopoverHover (no state needed)
  const [mobileSheetCommentId, setMobileSheetCommentId] = useState<string | null>(null)
  const isMobileRef = useRef(typeof window !== "undefined" && window.innerWidth <= 960)
  const [isMobile, setIsMobile] = useState(isMobileRef.current)

  useEffect(() => {
    const check = () => {
      isMobileRef.current = window.innerWidth <= 960
      setIsMobile(isMobileRef.current)
    }
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(new Set())
  const [exitingCommentIds, setExitingCommentIds] = useState<Set<string>>(new Set())

  // Skip popover entrance animation on file navigation (content change)
  const prevContentRef = useRef(content)
  const [skipPopoverAnim, setSkipPopoverAnim] = useState(false)
  useLayoutEffect(() => {
    if (prevContentRef.current !== content) {
      prevContentRef.current = content
      setSkipPopoverAnim(true)
      requestAnimationFrame(() => setSkipPopoverAnim(false))
    }
  }, [content])

  // ─── Widget system ─────────────────────────────────────────
  const resolvedWidgets = useMemo(() => widgets ?? getDefaultWidgets(), [widgets])
  const widgetLangMap = useMemo(() => buildLangMap(resolvedWidgets), [resolvedWidgets])
  const widgetRegistry = useMemo(() => buildWidgetRegistry(resolvedWidgets), [resolvedWidgets])

  const html = useMemo(() => parseWithPositions(content || "", widgetLangMap), [content, widgetLangMap])

  // Text selection tracking for comment pill
  const [pillPos, setPillPos] = useTextSelection(contentRef, html)

  // Compute highlight ranges directly from props (no store sync needed)
  const highlightRanges = useMemo(() => {
    const ranges: { id: string; from: number; to: number }[] = []
    for (const comment of comments) {
      const resolved = resolveAnchor(content, comment.anchor)
      if (resolved) ranges.push({ id: comment.id, from: resolved.from, to: resolved.to })
    }
    return ranges
  }, [comments, content])

  const draftRange = useMemo(
    () => draftComment ? { from: draftComment.from, to: draftComment.to } : null,
    [draftComment]
  )

  // ─── Manual innerHTML management ─────────────────────────────
  // React never touches the preview div's innerHTML. We own it via ref.

  const widgetCleanupsRef = useRef<(() => void)[]>([])

  useLayoutEffect(() => {
    const el = contentRef.current
    const htmlChanged = html !== lastHtmlRef.current
    const themeChanged = theme !== lastThemeRef.current
    if (!el || (!htmlChanged && !themeChanged)) return
    lastHtmlRef.current = html
    lastThemeRef.current = theme

    // Clean up previous widgets
    widgetCleanupsRef.current.forEach(fn => fn())
    widgetCleanupsRef.current = []

    if (htmlChanged) {
      el.innerHTML = html

      // Enable checkboxes
      el.querySelectorAll('input[type="checkbox"]').forEach((cb: Element) => {
        (cb as HTMLInputElement).disabled = false
      })
    }

    // Hydrate widget placeholders (runs on html OR theme change)
    widgetCleanupsRef.current = hydrateWidgets(el, theme, widgetRegistry)
  }, [html, theme, widgetRegistry])

  // ─── Apply highlights (runs before paint to avoid flash) ───

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el || !commentsVisible) {
      if (el) clearHighlights(el)
      return
    }

    applyHighlights(el, highlightRanges, draftRange)

    // Compute positions for comment popovers from highlight spans
    // Use .md-preview-inner as reference — it shares the same top edge as .md-preview-margin
    const mdPreview = el.closest(".md-preview-inner") || el
    const spans = comments
      .map(c => el.querySelector(`[data-comment-id="${c.id}"]`) as HTMLElement | null)
      .filter(Boolean) as HTMLElement[]
    const computed = computePopoverPositions(mdPreview as HTMLElement, spans)
    setCommentPositions(computed.map(p => ({ commentId: p.id, top: p.top })))
  }, [html, comments, highlightRanges, draftRange, commentsVisible])

  // Recompute positions on resize (content reflows change highlight positions)
  useEffect(() => {
    const el = contentRef.current
    if (!el || !commentsVisible) return
    const container = el.closest(".md-preview-inner") as HTMLElement
    if (!container) return

    const recompute = () => {
      const spans = comments
        .map(c => el.querySelector(`[data-comment-id="${c.id}"]`) as HTMLElement | null)
        .filter(Boolean) as HTMLElement[]
      const computed = computePopoverPositions(container, spans)
      setCommentPositions(computed.map(p => ({ commentId: p.id, top: p.top })))
    }

    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    window.addEventListener("resize", recompute)
    return () => { ro.disconnect(); window.removeEventListener("resize", recompute) }
  }, [comments, commentsVisible])

  // Reverse highlight: when hovering a popover, glow its highlight (imperative in handler)
  const updatePopoverHover = useCallback((id: string | null) => {
    const el = contentRef.current
    if (!el) return
    el.querySelectorAll("[data-comment-highlight].popover-hovered").forEach(
      h => h.classList.remove("popover-hovered")
    )
    if (id) {
      el.querySelectorAll(`[data-comment-id="${id}"]`).forEach(
        h => h.classList.add("popover-hovered")
      )
    }
  }, [])

  // No store subscription needed — highlights are driven by useMemo ranges above

  // ─── Click handling ──────────────────────────────────────────

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        const href = anchor.getAttribute("href")!
        if (href.startsWith("#")) {
          const target = el.querySelector(`#${CSS.escape(href.slice(1))}`)
          if (target) target.scrollIntoView({ behavior: "smooth" })
        } else if (onLinkClick && !href.startsWith("http://") && !href.startsWith("https://")) {
          onLinkClick(href)
        } else {
          window.open(href, "_blank")
        }
        return
      }

      const hl = (e.target as HTMLElement).closest("[data-comment-highlight]")
      if (hl) {
        const id = hl.getAttribute("data-comment-id")
        if (id) {
          // Mobile: open bottom sheet instead of toggling margin popover
          if (isMobileRef.current) {
            setMobileSheetCommentId(prev => prev === id ? null : id)
            return
          }
          setHiddenCommentIds(prev => {
            if (prev.has(id)) {
              // Show: remove from hidden immediately
              const next = new Set(prev)
              next.delete(id)
              return next
            }
            // Hide: animate exit first
            setExitingCommentIds(ex => new Set(ex).add(id))
            setTimeout(() => {
              setExitingCommentIds(ex => { const n = new Set(ex); n.delete(id); return n })
              setHiddenCommentIds(h => new Set(h).add(id))
            }, 150)
            return prev
          })
        }
      }
    }

    const handleMouseOver = (e: MouseEvent) => {
      const hl = (e.target as HTMLElement).closest("[data-comment-highlight]")
      setHoveredCommentId(hl ? hl.getAttribute("data-comment-id") : null)
    }
    const handleMouseOut = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-comment-highlight]")) setHoveredCommentId(null)
    }

    // Citation tooltips — render markdown content on hover
    let citationTooltip: HTMLElement | null = null
    const handleCitationOver = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest(".citation-ref a[data-citation]") as HTMLElement | null
      if (!link) return
      if (citationTooltip) citationTooltip.remove()

      const raw = link.getAttribute("data-citation") || ""
      const tip = document.createElement("div")
      tip.className = "citation-tooltip"
      tip.innerHTML = renderMarkdown(raw)

      const mdPreview = el.closest(".md-preview") as HTMLElement
      mdPreview.appendChild(tip)

      const linkRect = link.getBoundingClientRect()
      const containerRect = mdPreview.getBoundingClientRect()
      const tipLeft = Math.max(8, Math.min(
        linkRect.left - containerRect.left + linkRect.width / 2 - tip.offsetWidth / 2,
        containerRect.width - tip.offsetWidth - 8
      ))
      tip.style.top = `${linkRect.top - containerRect.top + (mdPreview.scrollTop || 0) - tip.offsetHeight - 6}px`
      tip.style.left = `${tipLeft}px`
      citationTooltip = tip
    }
    const handleCitationOut = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".citation-ref a[data-citation]")) {
        citationTooltip?.remove()
        citationTooltip = null
      }
    }

    el.addEventListener("click", handleClick)
    el.addEventListener("mouseover", handleMouseOver)
    el.addEventListener("mouseout", handleMouseOut)
    el.addEventListener("mouseover", handleCitationOver)
    el.addEventListener("mouseout", handleCitationOut)
    return () => {
      el.removeEventListener("click", handleClick)
      el.removeEventListener("mouseover", handleMouseOver)
      el.removeEventListener("mouseout", handleMouseOut)
      el.removeEventListener("mouseover", handleCitationOver)
      el.removeEventListener("mouseout", handleCitationOut)
      citationTooltip?.remove()
    }
  }, [html])

  // ─── Cmd+Shift+M to comment on selection ─────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "m") {
        e.preventDefault()
        if (pillPos && commentsVisible && !draftComment) {
          setDraftComment({ from: pillPos.from, to: pillPos.to, top: pillPos.top + 36 + 4 })
          setPillPos(null)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [pillPos, commentsVisible, draftComment])

  // ─── Resolve vertical collisions ─────────────────────────────

  const popoverRefs = useRef<Record<string, HTMLElement>>({})
  const [resolvedPositions, setResolvedPositions] = useState<any[]>([])

  // Clean up stale popoverRefs when comments are removed
  const commentIds = useMemo(() => new Set(comments.map(c => c.id)), [comments])
  useMemo(() => {
    for (const id of Object.keys(popoverRefs.current)) {
      if (id !== "draft" && !commentIds.has(id)) {
        delete popoverRefs.current[id]
      }
    }
  }, [commentIds])

  const visibleComments = useMemo(() => {
    return commentPositions.map(pos => {
      if (hiddenCommentIds.has(pos.commentId)) return null
      const comment = comments.find(c => c.id === pos.commentId)
      return comment ? { comment, top: pos.top } : null
    }).filter(Boolean) as { comment: Comment; top: number }[]
  }, [commentPositions, comments, hiddenCommentIds])

  const doResolve = useCallback(() => {
    const items = visibleComments.map(vc => ({
      id: vc.comment.id,
      type: "comment" as const,
      comment: vc.comment,
      top: vc.top,
      height: popoverRefs.current[vc.comment.id]?.offsetHeight || 80,
    }))
    if (draftComment) {
      items.push({
        id: "draft",
        type: "draft" as any,
        comment: null as any,
        top: draftComment.top,
        height: popoverRefs.current["draft"]?.offsetHeight || 120,
      })
    }
    setResolvedPositions(resolveCollisions(items))
  }, [visibleComments, draftComment])

  useEffect(() => {
    doResolve()
    const raf = requestAnimationFrame(() => doResolve())
    return () => cancelAnimationFrame(raf)
  }, [doResolve])

  // Track submitted draft so it renders as a committed comment card in-place
  const [submittedDraft, setSubmittedDraft] = useState<{ body: string; top: number; anchor: Anchor } | null>(null)

  // Clear submitted draft once the matching comment appears in props
  useEffect(() => {
    if (!submittedDraft) return
    const arrived = comments.some(c =>
      c.anchor.exact === submittedDraft.anchor.exact &&
      c.anchor.hint === submittedDraft.anchor.hint &&
      c.body === submittedDraft.body
    )
    if (arrived) {
      setSubmittedDraft(null)
      setDraftComment(null)
    }
  }, [comments, submittedDraft])

  const handleDraftSubmit = (body: string) => {
    if (!draftComment) return
    const anchor = createAnchorFn(content, draftComment.from, draftComment.to)
    setSubmittedDraft({ body, top: draftComment.top, anchor })
    onAddComment(anchor, body)
  }

  // ─── Render ──────────────────────────────────────────────────
  // The content div uses a plain ref — NO dangerouslySetInnerHTML.
  // innerHTML is managed imperatively via useLayoutEffect above.

  return (
    <div className="md-preview">
      <div className="md-preview-inner">
        <div ref={contentRef} className="md-preview-content" />
        {commentsVisible && pillPos && !draftComment && (
          <button
            className="comment-pill"
            aria-label="Add comment on selection"
            style={{ top: pillPos.top, left: pillPos.left }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDraftComment({ from: pillPos.from, to: pillPos.to, top: pillPos.top + 36 + 4 })
              setPillPos(null)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.getSelection()?.removeAllRanges()
              setDraftComment({ from: pillPos.from, to: pillPos.to, top: pillPos.top + 36 + 4 })
              setPillPos(null)
            }}
          >
            Comment
          </button>
        )}
      </div>
      <div className="md-preview-margin">
        {commentsVisible && resolvedPositions.map((item: any) => (
          item.type === "draft" ? (
            submittedDraft ? (
              <div
                key="draft-submitted"
                ref={(el: HTMLDivElement | null) => { if (el) popoverRefs.current["draft"] = el }}
                className="preview-comment-popover submitted"
                style={{ top: item.top }}
              >
                <div className="comment-card-header">
                  <div className="comment-card-author">
                    <div className="comment-avatar">
                      <Avatar size={20} name="You" variant="beam" colors={COMMENT_COLORS} />
                    </div>
                    <div className="comment-meta">
                      <span className="comment-name">You</span>
                    </div>
                  </div>
                </div>
                <div className="comment-card-body">
                  <div className="comment-text comment-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(submittedDraft.body) }} />
                </div>
                <div className="comment-reply-box">
                  <textarea className="comment-reply-input" placeholder="Reply..." rows={1} readOnly />
                </div>
              </div>
            ) : (
              <DraftCommentPopover
                key="draft"
                ref={(el: HTMLDivElement | null) => { if (el) popoverRefs.current["draft"] = el }}
                top={item.top}
                onSubmit={handleDraftSubmit}
                onClose={() => setDraftComment(null)}
              />
            )
          ) : (
            <PreviewCommentPopover
              key={item.comment.id}
              ref={(el: HTMLDivElement | null) => { if (el) popoverRefs.current[item.comment.id] = el }}
              comment={item.comment}
              content={content}
              top={item.top}
              highlighted={hoveredCommentId === item.comment.id}
              exiting={exitingCommentIds.has(item.comment.id)}
              skipAnimation={skipPopoverAnim}
              onDelete={onDeleteComment}
              onAddReply={onAddReply}
              onHover={updatePopoverHover}
            />
          )
        ))}
      </div>
      {isMobile && mobileSheetCommentId && (() => {
        const comment = comments.find(c => c.id === mobileSheetCommentId)
        if (!comment) return null
        return (
          <>
            <div className="comment-bottom-sheet-backdrop" aria-hidden="true" onClick={() => setMobileSheetCommentId(null)} />
            <div className="comment-bottom-sheet" role="dialog" aria-label="Comment thread">
              <div className="comment-bottom-sheet-handle" />
              <div className="comment-thread-scroll">
                <div className="comment-thread-item">
                  <div className="comment-thread-line">
                    <div className="comment-avatar">
                      <Avatar size={20} name={comment.author || "?"} variant="beam" colors={COMMENT_COLORS} />
                    </div>
                    <div className="comment-meta">
                      <span className="comment-name">{comment.author}</span>
                      {comment.createdAt && <span className="comment-time">{getTimeAgo(comment.createdAt)}</span>}
                    </div>
                  </div>
                  <div className="comment-thread-content">
                    {comment.body && <TruncatedBody html={renderMarkdown(comment.body)} />}
                  </div>
                </div>
                {comment.replies?.map(reply => (
                  <div key={reply.id} className="comment-thread-item">
                    <div className="comment-thread-line">
                      <div className="comment-avatar">
                        <Avatar size={20} name={reply.author || "?"} variant="beam" colors={COMMENT_COLORS} />
                      </div>
                      <div className="comment-meta">
                        <span className="comment-name">{reply.author}</span>
                        <span className="comment-time">{getTimeAgo(reply.createdAt)}</span>
                      </div>
                    </div>
                    <div className="comment-thread-content">
                      <TruncatedBody html={renderMarkdown(reply.body)} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="comment-reply-box">
                <textarea className="comment-reply-input" placeholder="Reply..." rows={1}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      const val = (e.target as HTMLTextAreaElement).value.trim()
                      if (val) { onAddReply(comment.id, val); (e.target as HTMLTextAreaElement).value = "" }
                    }
                  }}
                />
                <button className="comment-send" onClick={e => {
                  const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLTextAreaElement
                  if (input?.value.trim()) { onAddReply(comment.id, input.value.trim()); input.value = "" }
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 11V3M7 3L4 6M7 3L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

// ─── Preview comment popover ──────────────────────────────────────

interface PreviewPopoverProps {
  comment: Comment
  content: string
  top: number
  highlighted: boolean
  exiting?: boolean
  skipAnimation?: boolean
  onDelete: (id: string) => void
  onAddReply: (commentId: string, body: string) => void
  onHover: (id: string | null) => void
}

function TruncatedBody({ html, plain }: { html?: string; plain?: string }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const check = () => setTruncated(el.scrollHeight > el.clientHeight)
    check()
    // Double-check after paint in case innerHTML hasn't laid out yet
    requestAnimationFrame(check)
  }, [html, plain])

  return (
    <div className={`comment-body-wrap${expanded ? " expanded" : ""}`}>
      <div ref={bodyRef} className={`comment-text comment-md${!expanded ? " comment-text-limit" : ""}${truncated && !expanded ? " comment-text-clamp" : ""}`}
        {...(html ? { dangerouslySetInnerHTML: { __html: html } } : { children: plain })}
      />
      {truncated && !expanded && (
        <button className="comment-view-more" onClick={() => setExpanded(true)}>View more</button>
      )}
      {expanded && (
        <button className="comment-view-more" onClick={() => setExpanded(false)}>Show less</button>
      )}
    </div>
  )
}

const PreviewCommentPopover = forwardRef<HTMLDivElement, PreviewPopoverProps>(({
  comment, content: _content, top, highlighted, exiting, skipAnimation, onDelete, onAddReply, onHover,
}, ref) => {
  const [replyText, setReplyText] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [absTop, setAbsTop] = useState(0)
  const localRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const handleReply = () => {
    if (!replyText.trim()) return
    onAddReply(comment.id, replyText.trim())
    setReplyText("")
  }

  const [absLeft, setAbsLeft] = useState(0)

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!expanded && localRef.current) {
      const rect = localRef.current.getBoundingClientRect()
      setAbsTop(rect.top)
      setAbsLeft(rect.left)
    }
    setExpanded(!expanded)
  }

  // Merge refs
  const setRefs = (el: HTMLDivElement | null) => {
    (localRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    if (typeof ref === "function") ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
  }

  return (
    <div
      ref={setRefs}
      className={`preview-comment-popover${skipAnimation ? " no-animate" : ""}${highlighted ? " highlighted" : ""}${exiting ? " exiting" : ""}${expanded ? " expanded" : ""}`}
      style={{ top, "--popover-top": `${top}px`, "--popover-top-abs": `${absTop}px`, "--popover-left-abs": `${absLeft}px` } as React.CSSProperties}
      onMouseEnter={() => onHover(comment.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="popover-actions">
        <button
          className="popover-action-btn popover-delete-btn"
          onClick={() => onDelete(comment.id)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <button
          className="popover-action-btn popover-expand-btn"
          onClick={handleExpand}
        >
        {expanded ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 1L5 5H1M9 13L9 9H13M5 5L1 1M9 9L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 5V1H5M13 9V13H9M1 1L5 5M13 13L9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        </button>
      </div>
      <div className="comment-thread-scroll">
        <div className="comment-thread-item">
          <div className="comment-thread-line">
            <div className="comment-avatar">
              <Avatar size={20} name={comment.author || "?"} variant="beam" colors={COMMENT_COLORS} />
            </div>
            <div className="comment-meta">
              <span className="comment-name">{comment.author}</span>
              {comment.createdAt && <span className="comment-time">{getTimeAgo(comment.createdAt)}</span>}
            </div>
          </div>
          <div className="comment-thread-content">
            {comment.body && (expanded
              ? <div className="comment-text comment-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body) }} />
              : <TruncatedBody html={renderMarkdown(comment.body)} />
            )}
          </div>
        </div>
        {comment.replies?.map(reply => (
          <div key={reply.id} className="comment-thread-item">
            <div className="comment-thread-line">
              <div className="comment-avatar">
                <Avatar size={20} name={reply.author || "?"} variant="beam" colors={COMMENT_COLORS} />
              </div>
              <div className="comment-meta">
                <span className="comment-name">{reply.author}</span>
                <span className="comment-time">{getTimeAgo(reply.createdAt)}</span>
              </div>
            </div>
            <div className="comment-thread-content">
              {expanded
                ? <div className="comment-text comment-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(reply.body) }} />
                : <TruncatedBody html={renderMarkdown(reply.body)} />
              }
            </div>
          </div>
        ))}
      </div>
      <div className="comment-reply-box">
        <textarea
          ref={inputRef}
          className="comment-reply-input"
          placeholder="Reply..."
          autoCorrect="off" autoCapitalize="off" spellCheck={false}
          rows={expanded ? 3 : 1}
          value={replyText}
          onChange={e => {
            setReplyText(e.target.value)
            if (!expanded) {
              e.target.style.height = "auto"
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
            }
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply() }
          }}
        />
        <button className="comment-send" onClick={handleReply}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 11V3M7 3L4 6M7 3L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
})

// ─── Draft comment popover ────────────────────────────────────────

interface DraftPopoverProps {
  top: number
  onSubmit: (body: string) => void
  onClose: () => void
}

const DraftCommentPopover = forwardRef<HTMLDivElement, DraftPopoverProps>(({ top, onSubmit, onClose }, ref) => {
  const [body, setBody] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  const handlePost = () => {
    if (!body.trim()) return
    onSubmit(body.trim())
  }

  return (
    <div ref={ref} className="preview-comment-popover" style={{ top }}>
      <div className="comment-card-header">
        <div className="comment-card-author">
          <div className="comment-avatar">
            <Avatar size={20} name="You" variant="beam" colors={COMMENT_COLORS} />
          </div>
          <div className="comment-meta">
            <span className="comment-name">You</span>
          </div>
        </div>
        <button className="comment-menu" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
      <div className="comment-reply-box">
        <textarea
          ref={inputRef}
          className="comment-reply-input"
          placeholder="Add a comment..."
          autoCorrect="off" autoCapitalize="off" spellCheck={false}
          rows={1}
          value={body}
          onChange={e => {
            setBody(e.target.value)
            e.target.style.height = "auto"
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost() }
            if (e.key === "Escape") onClose()
          }}
        />
        <button className="comment-send" onClick={handlePost}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 11V3M7 3L4 6M7 3L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
})
