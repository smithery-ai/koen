import type { Anchor, Comment, WidgetPlugin } from "./types"

export interface WorkspaceFile {
  id: string
  path: string
  content: string
  comments: Comment[]
}

export interface DataProvider {
  createComment: (fileId: string, anchor: Anchor, body: string) => Promise<{ id: string }>
  deleteComment: (fileId: string, commentId: string) => Promise<void>
  addReply: (fileId: string, commentId: string, body: string) => Promise<{ id: string }>
  updateFile?: (fileId: string, content: string) => Promise<void>
}

export type WorkspaceEventType =
  | { type: "comment:created"; fileId: string; comment: Comment }
  | { type: "comment:deleted"; fileId: string; commentId: string }
  | { type: "reply:created"; fileId: string; commentId: string; reply: Comment["replies"][0] }
  | { type: "file:updated"; fileId: string; content: string }
  | { type: "file:created"; fileId: string; path: string; content: string }
  | { type: "file:deleted"; fileId: string }
  | { type: "reload" }

export interface WorkspaceProps {
  /** Files to display */
  files: WorkspaceFile[]
  /** Folder/project title for breadcrumb root */
  title?: string
  /** Disable editing */
  readOnly?: boolean
  /** Show existing comments but hide inputs */
  commentsLocked?: boolean

  /** Data persistence callbacks */
  data: DataProvider

  /** Currently active file path */
  activePath?: string | null
  /** Called when user navigates to a file */
  onNavigate?: (path: string | null) => void

  /** Subscribe to external real-time events (WebSocket, Tauri events, etc.) */
  onExternalEvent?: (handler: (event: WorkspaceEventType) => void) => (() => void)

  /** Theme */
  theme?: "dark" | "light"
  /** Called when user toggles theme */
  onThemeChange?: (theme: "dark" | "light") => void

  /** Extra elements in the header (share button, app-specific actions) */
  headerExtra?: React.ReactNode
  /** Content to show when no file is selected */
  emptyState?: React.ReactNode
  /** Root name in breadcrumb (e.g. folder slug) */
  rootName?: string
  /** Widget plugins for markdown preview */
  widgets?: WidgetPlugin[]
  /** Default mode for markdown files: "preview" (read-only), "live" (WYSIWYG), "source" (raw) */
  markdownMode?: "source" | "preview" | "live"
}
