import { create } from "zustand"

interface FileTreeState {
  expanded: Set<string>
  toggle: (path: string) => void
  collapseAll: (keep?: string[]) => void
  expandAll: (paths: string[]) => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  expanded: new Set<string>(["__root__"]),
  toggle: (path) =>
    set((state) => {
      const next = new Set(state.expanded)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { expanded: next }
    }),
  collapseAll: (keep = ["__root__"]) =>
    set({ expanded: new Set(keep) }),
  expandAll: (paths) =>
    set((state) => {
      const next = new Set(state.expanded)
      for (const p of paths) next.add(p)
      return { expanded: next }
    }),
}))
