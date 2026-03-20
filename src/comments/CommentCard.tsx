/**
 * Single comment card with threaded replies.
 * Pure UI — no stores, no backend calls.
 */

import { useState, useRef, useEffect } from "react"
import Avatar from "boring-avatars"
import { renderMarkdown } from "../sanitize"

import type { Comment, Reply } from "../types"
import { COMMENT_COLORS, getTimeAgo } from "../utils"

interface Props {
  comment: Comment
  isActive: boolean
  onActivate: (id: string) => void
  onDeactivate: () => void
  onDelete: (id: string) => void
  onSubmitBody: (id: string, body: string) => void
  onAddReply: (commentId: string, body: string) => void
}

export default function CommentCard({
  comment,
  isActive,
  onActivate,
  onDeactivate,
  onDelete,
  onSubmitBody,
  onAddReply,
}: Props) {
  const [replyText, setReplyText] = useState("")
  const [isNew, setIsNew] = useState(!comment.body)
  const [newBody, setNewBody] = useState("")
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isActive])

  const handleSubmitNew = () => {
    if (!newBody.trim()) return
    onSubmitBody(comment.id, newBody.trim())
    setIsNew(false)

  }

  const handleSubmitReply = () => {
    if (!replyText.trim()) return
    onAddReply(comment.id, replyText.trim())
    setReplyText("")

  }

  const handleKeyDown = (e: React.KeyboardEvent, onSubmit: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
    if (e.key === "Escape") {
      onDeactivate()
    }
  }

  const timeAgo = getTimeAgo(comment.createdAt)

  return (
    <div
      className={`comment-card ${isActive ? "active" : ""}`}
      onClick={() => onActivate(comment.id)}
    >
      <div className="comment-card-header">
        <div className="comment-card-author">
          <div className="comment-avatar">
            <Avatar size={20} name={comment.author || "?"} variant="beam" colors={COMMENT_COLORS} />
          </div>
          <div className="comment-meta">
            <span className="comment-name">{comment.author}</span>
            <span className="comment-time">{timeAgo}</span>
          </div>
        </div>
        <button className="comment-menu" onClick={() => onDelete(comment.id)} title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      {isNew ? (
        <div className="comment-card-body">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="comment-input"
            placeholder="Type your comment..."
            autoCorrect="off" autoCapitalize="off" spellCheck={false}
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            onKeyDown={e => handleKeyDown(e, handleSubmitNew)}
            rows={2}
          />
          <div className="comment-card-actions">
            <button className="comment-cancel" onClick={() => onDelete(comment.id)}>Cancel</button>
            <button className="comment-post" onClick={handleSubmitNew}>Post</button>
          </div>
        </div>
      ) : (
        <>
          <div className="comment-card-body">
            <div className="comment-text comment-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body) }} />
          </div>

          {comment.replies?.map((reply: Reply) => (
            <div key={reply.id} className="comment-reply">
              <div className="comment-card-author">
                <div className="comment-avatar small">
                  <Avatar size={20} name={reply.author || "?"} variant="beam" colors={COMMENT_COLORS} />
                </div>
                <div className="comment-meta">
                  <span className="comment-name">{reply.author}</span>
                  <span className="comment-time">{getTimeAgo(reply.createdAt)}</span>
                </div>
              </div>
              <div className="comment-text comment-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(reply.body) }} />
            </div>
          ))}

          {isActive && (
            <div className="comment-reply-box">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                className="comment-reply-input"
                placeholder="Reply..."
                autoCorrect="off" autoCapitalize="off" spellCheck={false}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => handleKeyDown(e, handleSubmitReply)}
              />
              <button className="comment-send" onClick={handleSubmitReply}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 11V3M7 3L4 6M7 3L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
