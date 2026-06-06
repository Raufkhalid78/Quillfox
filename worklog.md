# QuillFox - Shared Sidebar & New Views Implementation

## Summary
Implemented a shared `AppSidebar` component and added three new full-page views (Notes, Todos, Workspaces) to the QuillFox app, along with updated store, routing, and view wrappers.

## Changes Made

### 1. Zustand Store (`src/stores/app-store.ts`)
- Added new view types: `'notes'`, `'todos'`, `'workspaces'` to `AppView` type
- Added `selectedWorkspaceId: string | null` state and `setSelectedWorkspaceId` action
- Updated `selectNote('')` to navigate to `'notes'` view (instead of `'dashboard'`)
- Updated `selectTodo('')` to navigate to `'todos'` view (instead of `'dashboard'`)
- Added `selectedWorkspaceId: null` to logout reset

### 2. Shared AppSidebar (`src/components/shared/app-sidebar.tsx`)
- New shared component extracted from Dashboard's inline sidebar
- Props: `activeView: string` and optional `onUpgradeClick?: () => void`
- Nav items: Dashboard (Home), Notes (FileText), Todos (ListTodo), Workspaces (Layers), Upgrade (Crown)
- Bottom actions: Theme toggle (Sun/Moon), Logout (LogOut)
- Active state styling: `bg-primary/10 text-primary`
- Responsive: `hidden md:flex` with `w-[72px]`

### 3. Notes List View (`src/components/notes/notes-list.tsx`)
- Full-page view showing all non-archived notes
- Decryption support via `decryptNoteTitle` and `decryptNoteContent`
- Create Note dialog with optional workspace assignment
- Click to open note (selectNote)
- Empty state with CTA
- Mobile header with logo and theme toggle

### 4. Todos List View (`src/components/todos/todos-list.tsx`)
- Full-page view showing all non-archived todo lists
- Decryption support via `decryptTodoTitle`
- Progress bars for each todo list
- Create Todo dialog with optional workspace assignment
- Click to open todo (selectTodo)
- Empty state with CTA

### 5. Workspaces View (`src/components/workspaces/workspaces-view.tsx`)
- Full-page view showing all workspaces as cards
- Card layout with color dot, title, description, stats, created date
- Workspace detail dialog with members management
- Quick create notes/todos within workspace
- Invite/remove member functionality
- Create workspace dialog with color picker
- Empty state with CTA

### 6. Dashboard Updates (`src/components/dashboard/dashboard.tsx`)
- Replaced inline `<aside>` sidebar with `<AppSidebar>` component
- "View all" buttons now navigate to `notes`/`todos` views (via `setView`)
- Fixed `useTheme` hook placement (moved before early return)

### 7. NoteEditor Updates (`src/components/note/note-editor.tsx`)
- Wrapped with `<AppSidebar activeView="note-editor" />`
- Content area wrapped in flex container

### 8. TodoList Updates (`src/components/todo/todo-list.tsx`)
- Wrapped with `<AppSidebar activeView="todo-list" />`
- Content area wrapped in flex container

### 9. Page Routing (`src/app/page.tsx`)
- Added imports for `NotesList`, `TodosList`, `WorkspacesView`
- Added `AnimatePresence` entries for `'notes'`, `'todos'`, `'workspaces'` views
