import { useFileTreeStore } from "./store"

export interface TreeFile {
  id: string
  path: string
  [key: string]: any
}

export interface FileTreeProps {
  files: TreeFile[]
  activePath?: string | null
  title?: string
  rootName?: string
  theme?: "dark" | "light"
  onFileSelect?: (file: TreeFile) => void
}

// ─── Tree building ──────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  file?: TreeFile
  children: TreeNode[]
}

function buildTree(files: TreeFile[]): TreeNode[] {
  const root: TreeNode[] = []
  const dirMap = new Map<string, TreeNode>()

  function ensureDir(dirPath: string): TreeNode {
    if (dirMap.has(dirPath)) return dirMap.get(dirPath)!
    const parts = dirPath.split("/")
    const name = parts[parts.length - 1]
    const node: TreeNode = { name, path: dirPath, isDir: true, children: [] }
    dirMap.set(dirPath, node)

    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join("/")
      const parent = ensureDir(parentPath)
      parent.children.push(node)
    }
    return node
  }

  for (const file of files) {
    const parts = file.path.split("/")
    const name = parts[parts.length - 1]
    const node: TreeNode = { name, path: file.path, isDir: false, file, children: [] }

    if (parts.length === 1) {
      root.push(node)
    } else {
      const dirPath = parts.slice(0, -1).join("/")
      const parent = ensureDir(dirPath)
      parent.children.push(node)
    }
  }

  // Sort: folders first (alphabetically), then files (alphabetically)
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.children.length) sortChildren(n.children)
    }
  }
  sortChildren(root)

  return root
}

// ─── Icons ──────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`sono-tree-chevron ${open ? "open" : ""}`}
      width="16" height="16" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

function FileIcon() {
  return (
    <span className="tree-file-badge">M</span>
  )
}

// ─── TreeNode component ─────────────────────────────────────

function TreeItem({
  node,
  depth,
  activePath,
  onFileSelect,
}: {
  node: TreeNode
  depth: number
  activePath?: string | null
  onFileSelect?: (file: TreeFile) => void
}) {
  const isOpen = useFileTreeStore((s) => s.expanded.has(node.path))
  const toggle = useFileTreeStore((s) => s.toggle)
  const isActive = !node.isDir && node.path === activePath

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (node.isDir) {
      toggle(node.path)
    } else if (node.file && onFileSelect) {
      onFileSelect(node.file)
    }
  }

  return (
    <div className="sono-tree-node">
      <div
        className={`sono-tree-row ${node.isDir ? "dir" : "file"} ${isActive ? "active" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.isDir ? <ChevronIcon open={isOpen} /> : <FileIcon />}
        <span className="sono-tree-label">{node.name}</span>
      </div>
      {node.isDir && isOpen && (
        <div className="sono-tree-children">
          {node.children.map(child => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FileTree component ─────────────────────────────────────

export default function FileTree({ files, activePath, title, rootName, onFileSelect }: FileTreeProps) {
  const tree = buildTree(files)
  const rootOpen = useFileTreeStore((s) => s.expanded.has("__root__"))
  const toggle = useFileTreeStore((s) => s.toggle)

  const treeItems = tree.map(node => (
    <TreeItem
      key={node.path}
      node={node}
      depth={rootName ? 1 : 0}
      activePath={activePath}
      onFileSelect={onFileSelect}
    />
  ))

  return (
    <div className="sono-file-tree">
      {title && !rootName && <div className="sono-tree-title">{title}</div>}
      <div className="sono-tree-list">
        {rootName ? (
          <div className="sono-tree-node">
            <div
              className="sono-tree-row dir sono-tree-root"
              style={{ paddingLeft: "8px" }}
              onClick={() => toggle("__root__")}
            >
              <ChevronIcon open={rootOpen} />
              <span className="sono-tree-label">{rootName}</span>
            </div>
            {rootOpen && (
              <div className="sono-tree-children">
                {treeItems}
              </div>
            )}
          </div>
        ) : (
          treeItems
        )}
      </div>
    </div>
  )
}
