# Workspace Extraction — Build Program

## Spec

Extract the generic editor orchestration from blurb's FolderView into a `Workspace` component in engei with a `DataProvider` interface.

## Steps

1. Create `src/Workspace.tsx` in engei with DataProvider pattern
2. Create `src/workspace-types.ts` for WorkspaceProps, DataProvider, WorkspaceFile, WorkspaceEvent
3. Export from `src/index.ts`
4. Refactor blurb's FolderView to use `<Workspace data={webAdapter} />`
5. Verify blurb builds
6. Scaffold blurb-desktop Tauri app

## What moves to Workspace
- Sidebar layout (open/close, backdrop, collapse)
- FileTree wiring
- Breadcrumb construction
- Theme state + CSS variable syncing
- Optimistic comment/reply CRUD
- Internal link resolution
- Header layout + theme toggle + copy button
- Editor rendering with mode detection
- Icon components (Sun, Moon, Copy, Check)

## What stays in consumer
- Data fetching (fetchFolder, postComment, etc.)
- WebSocket / real-time subscription
- Routing (window.history, Tauri navigation)
- App-specific chrome (ShareModal, Fern 404)
- document.title, localStorage
- Loading/error states
