# Notely - Worklog

## Overview
Built "Notely", a comprehensive productivity workspace web application combining rich-text notetaking and structured to-do lists with real-time collaboration capabilities.

## Date: 2025

---

## Architecture
- **Single-page app** with Zustand managing client-side view switching (auth → dashboard → note-editor / todo-list)
- **Next.js 16 App Router** with TypeScript, Tailwind CSS 4, shadcn/ui
- **Prisma ORM** with SQLite for data persistence
- **Socket.io** mini-service for real-time collaboration (port 3004)
- **MDXEditor** for rich text editing
- **HTML5 Drag & Drop** for todo item reordering
- **Color scheme**: Warm neutrals with emerald/teal accent

---

## Files Created

### State Management
- `src/stores/app-store.ts` - Zustand store with persistence, managing views, auth, notes, todos, collaboration state

### Frontend Components
- `src/app/page.tsx` - Main entry with ThemeProvider + view router
- `src/components/auth/auth-page.tsx` - Login/Register with tab switching, emerald gradient background
- `src/components/dashboard/dashboard.tsx` - Dashboard with stats, workspace cards, recent notes/todos grid, FAB for creating
- `src/components/note/note-editor.tsx` - MDXEditor rich text note editor with auto-save, lock banner, collaborator avatars
- `src/components/todo/todo-list.tsx` - Todo list with checkboxes, drag-and-drop reorder, progress bar, add/delete items

### API Routes
- `src/app/api/auth/register/route.ts` - User registration with bcrypt password hashing
- `src/app/api/auth/login/route.ts` - Login credential verification
- `src/app/api/workspaces/route.ts` - GET (list) / POST (create) workspaces
- `src/app/api/notes/route.ts` - GET (list) / POST (create) notes
- `src/app/api/notes/[id]/route.ts` - GET / PUT / DELETE single note
- `src/app/api/todos/route.ts` - GET (list) / POST (create) todo lists
- `src/app/api/todos/[id]/route.ts` - GET / PUT / DELETE single todo list
- `src/app/api/todos/[id]/items/route.ts` - POST (create) / PUT (batch update) todo items

### WebSocket Collaboration Service
- `mini-services/collab-service/index.ts` - Socket.io server on port 3004
  - Document session management (join/leave)
  - Exclusive edit locks with 30s auto-expiry
  - Activity heartbeat to keep locks alive
  - Real-time content update and item completion broadcasts
  - Active users tracking per document

### Hooks
- `src/hooks/use-collab-socket.ts` - React hook for WebSocket collaboration connection management

### Assets
- `public/notely-logo.png` - AI-generated app logo (emerald green)
- `public/notely-hero.png` - AI-generated hero banner

---

## Key Features
1. **Auth System** - Email/password registration and login with bcrypt hashing
2. **Dashboard** - Stats overview, workspace cards, recent notes and todos in responsive grid
3. **Rich Text Notes** - MDXEditor with headings, lists, quotes, markdown shortcuts, auto-save
4. **Todo Lists** - Checkboxes, drag-and-drop reorder, progress bar, inline add/delete
5. **Real-time Collaboration** - Socket.io based document locking, presence indicators, content sync
6. **Dark Mode** - Full dark/light theme support via next-themes
7. **Responsive Design** - Mobile-first with 1/2/3 column grid breakpoints
8. **Sticky Footer** - Always anchored to bottom

## Testing
- All API routes tested and verified working
- Auth: register + login flow works
- Notes: create, read, update, delete all functional
- Todos: create list, add items, toggle completion, delete items, reorder working
- FAB dialog: create new note and todo list from dashboard
- Dark mode toggle: works correctly
- Responsive: mobile (375px) to desktop (1920px) layout adapts
- Logout: clears state and returns to auth screen
- ESLint passes clean (0 errors, 0 warnings)
- Dev server compiles without errors

## Bug Fixes Applied
1. **MDXEditor plugin double-instantiation** - Fixed by loading module once and using plugin functions directly in JSX
2. **MDXEditor CSS import** - Added `@mdxeditor/editor/style.css` to layout.tsx
3. **Todo items stale closure** - Fixed debounce save using `useRef` for items to avoid stale closures in timeouts
4. **Unused imports cleanup** - Removed unused Save, Lock, Users, Badge imports from note editor; unused type imports from dashboard

---
Task ID: rebrand-e2ee
Agent: main
Task: Rebrand "Notely" to "QuillFox" and implement End-to-End Encryption

Work Log:
- Rebranded all "Notely" references to "QuillFox" across layout.tsx, page.tsx, auth-page.tsx, dashboard.tsx, and app-store.ts
- Updated metadata, descriptions, keywords, and footer text
- Changed localStorage key from 'notely-app-storage' to 'quillfox-app-storage'
- Added `salt` field (String?) to User model in Prisma schema
- Ran `bun run db:push` to apply schema migration
- Created `src/lib/e2ee.ts` - Client-side E2E encryption utility using Web Crypto API (PBKDF2 + AES-GCM-256)
- Updated `src/stores/app-store.ts` with encryption state (encryptionKey, encryptionSalt, isEncryptedSession) and actions (setEncryptionKey, clearEncryption), excluded CryptoKey from persist via partialize
- Updated register API to accept and store `salt` field
- Updated login API to return `salt` field in response
- Created `src/lib/encrypted-api.ts` - Wrapper functions for encrypting/decrypting note content, note titles, and todo titles
- Updated auth-page.tsx to derive encryption key on login/register using password + salt, with ShieldCheck badges explaining E2E
- Updated note-editor.tsx to decrypt content/title on load and encrypt before save, added ShieldCheck/ShieldAlert encryption indicator
- Updated todo-list.tsx to decrypt item titles on load and encrypt before save, with encryption indicator
- Updated dashboard.tsx to decrypt note previews and todo titles in useEffect, added E2E badge in header and per-card encryption indicators
- Added Tooltip components with encryption status messages throughout
- Ran `bun run lint` - 0 errors, 0 warnings
- Dev server compiles successfully with no errors

Stage Summary:
- Full rebrand from "Notely" to "QuillFox" completed across 5 files
- End-to-end encryption implemented using PBKDF2 (100k iterations) + AES-GCM-256
- All note content and todo item titles are encrypted client-side before storage
- Server never sees plaintext content - only stores encrypted base64 strings
- Encryption key derived from user password, never sent to server
- Salt stored server-side (not secret) for key re-derivation on login
- Green shield icon shown when encryption is active, amber warning when not
- Backward compatible: existing unencrypted data still works via isEncrypted() check
