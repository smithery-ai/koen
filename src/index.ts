// Main component
export { default as SonoEditor } from "./SonoEditor"

// File tree
export { default as FileTree } from "./tree/FileTree"
export type { TreeFile, FileTreeProps } from "./tree/FileTree"
export { useFileTreeStore } from "./tree/store"

// Types
export type { Comment, Reply, Anchor, SonoEditorProps } from "./types"

// Pure utilities
export { createAnchor, resolveAnchor, resolveAnchors } from "./comments/anchoring"

// CM6 building blocks (for advanced consumers)
export { commentField, setComments, addComment, removeComment, getCommentRanges } from "./comments/CommentDecoration"

// Markdown utilities (for custom preview consumers)
export { parseWithPositions, domRangeToSourceRange, wrapSourceRange, clearHighlights } from "./preview/markedPositions"

// Widget registry (for consumers to register custom widget types)
export { registerWidget, hydrateWidgets } from "./widgets/registry"
export type { WidgetSpec, WidgetHydrator } from "./widgets/registry"

// Built-in widgets (imported for side effects — registers widget types)
import "./widgets/ChartWidget"
import "./widgets/MermaidWidget"
import "./widgets/DiffWidget"

// Styles — import "sono-editor/styles" in your app
import "./styles/sono-editor.css"
