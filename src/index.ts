// Main component
export { default as Editor } from "./Editor"
export type { EditorHandle } from "./Editor"

// File tree
export { default as FileTree } from "./tree/FileTree"
export type { TreeFile, FileTreeProps } from "./tree/FileTree"
export { useFileTreeStore } from "./tree/store"

// Types
export type { Comment, Reply, Anchor, EditorProps, WidgetPlugin } from "./types"

// Pure utilities
export { createAnchor, resolveAnchor, resolveAnchors } from "./comments/anchoring"

// CM6 building blocks (for advanced consumers)
export { commentField, setComments, addComment, removeComment, getCommentRanges } from "./comments/CommentDecoration"

// Markdown utilities (for custom preview consumers)
export { parseWithPositions, domRangeToSourceRange, wrapSourceRange, clearHighlights } from "./preview/markedPositions"

// Widget system (re-exported from engei-widgets)
export {
  hydrateWidgets,
  buildWidgetRegistry,
  buildLangMap,
  getDefaultWidgets,
  chartPlugin,
  mermaidPlugin,
  diffPlugin,
  globePlugin,
  katexPlugin,
  tablePlugin,
  embedPlugin,
  excalidrawPlugin,
  mapPlugin,
  timelinePlugin,
  calendarPlugin,
  htmlPlugin,
} from "engei-widgets"
export type { WidgetSpec, WidgetHydrator } from "engei-widgets"

// Styles — import "engei/styles" in your app
import "./styles/engei.css"
