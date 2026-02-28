# Git Branch Organiser

A lightweight Electron desktop application for managing local git branches. Built for developers who accumulate many local branches from code reviews and experimentation, and want a safe, visual way to clean them up.

## Problem

When you regularly check out PR branches locally for review, your local branch list grows quickly. Deleting branches via CLI is tedious and risky — you might lose work you meant to keep. Git Branch Organiser gives you a visual interface to see what's safe to delete and a recycle bin so nothing is permanently lost until you say so.

## Core Features

### Branch Tree View

- Displays local branches as a tree based on the `/` delimiter (e.g. `feature/auth/login` renders nested under `feature` > `auth`)
- Shows for each branch:
  - **Ahead/behind counts** relative to its remote tracking branch
  - **Human-readable status** — e.g. "Remote branch deleted", "2 unpushed commits", "No remote tracking branch (local only)", "Up to date with remote"
  - **Last commit date** and message
- The currently checked-out branch is **visually distinguished** and **excluded from selection**
- Default sort order: alphabetical

### Multi-Select & Power-User UX

- **Click** to toggle selection on individual branches (additive — does not replace existing selection)
- **Shift+Click** to apply the last action across a range:
  - If the last click **checked** a branch, Shift+Click checks the entire range
  - If the last click **unchecked** a branch, Shift+Click unchecks the entire range
- **Select All** / **Deselect All** controls in the toolbar

### Safe Deletion via Recycle Bin

- "Deleting" a branch performs a **soft delete** — the branch is renamed to `recyclebin/<original-branch-path>` (preserving the full path for potential future restore)
  - This is a fast `git branch -m` operation, not an actual deletion
- If a branch literally named `recyclebin` already exists (which would conflict with the namespace), the app tries `recyclebin2`, `recyclebin3`, etc. until an available prefix is found
- **Warning popup** when moving branches that have:
  - Unpushed commits (ahead of remote)
  - No remote tracking branch at all (purely local, never pushed)
  - Remote tracking branch that has been deleted

### Recycle Bin Management

- "Empty Recycle Bin" button permanently deletes all branches under the `recyclebin/` prefix
- Shows a loading spinner during deletion (this may take time with many branches)
- For now, only deletes **local** branches

### Multi-Repo Support

- Open multiple git repositories as **tabs** within the application
- Each tab operates independently on its own repo

### Session Persistence

- Open tabs and branch data are **cached in localStorage** so the app restores your session on restart
- On startup, cached branches are displayed immediately (no loading spinner) while a **background refresh** fetches the latest state for all open repos

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Desktop shell | **Electron** | Mature ecosystem, direct Node.js access for git operations |
| Build tooling | **Electron Forge** | Officially recommended Electron build/package tool |
| Frontend | **Svelte 4** | Lightweight, simple reactivity model — fits the narrow UI scope |
| Git operations | **simple-git** | Well-maintained TypeScript-friendly wrapper around git CLI |
| Language | **TypeScript** | End-to-end type safety, both main and renderer processes |
| Bundler | **Vite** | Fast HMR in development, used via Electron Forge Vite plugin |

## Architecture

```
┌─────────────────────────────────────────────┐
│                Renderer (Svelte)             │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Tab Bar │ │Branch    │ │ Recycle Bin   │  │
│  │         │ │Tree View │ │ Panel        │  │
│  └─────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────┐   │
│  │  localStorage (session persistence)  │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│              IPC (contextBridge)             │
├─────────────────────────────────────────────┤
│              Main Process (Node.js)         │
│  ┌──────────────────────────────────────┐   │
│  │  Git Service (simple-git)            │   │
│  │  - list branches (batched query)     │   │
│  │  - rename (soft delete)              │   │
│  │  - delete (empty recycle bin)        │   │
│  │  - branch warnings (batched query)   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- **Main process** handles all git operations via `simple-git`. No git commands run from the renderer.
- **Renderer** communicates with the main process via Electron IPC (exposed through `contextBridge`/`preload`).
- Each open repo tab corresponds to a separate `simple-git` instance pointed at that directory.
- Branch listing uses a single batched `git for-each-ref` call to fetch all branch metadata at once, keeping load times fast even with hundreds of branches.

## Development

```bash
# Install dependencies
npm install

# Start in development mode (with hot reload)
npm start
```

## Future Features

- **Restore from recycle bin** — move branches back from `recyclebin/` to their original path
- **Branch grouping/filtering** — group by "my branches" vs "others'" (by commit author), filter by last activity date
- **Custom sort orders** — sort by last commit date, ahead/behind count, etc.
- **Remote branch deletion** — option to also delete the remote tracking branch
- **Batch operations** — bulk merge-status checking, bulk fetch
