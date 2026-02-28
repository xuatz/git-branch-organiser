<script lang="ts">
  import { onMount } from 'svelte';
  import TabBar from './components/TabBar.svelte';
  import BranchView from './components/BranchView.svelte';
  import type { RepoTab, BranchInfo } from '../shared/types';

  const STORAGE_KEY = 'git-branch-organiser-state';

  interface AppState {
    tabs: RepoTab[];
    activeTabId: string | null;
    branchCache: Record<string, BranchInfo[]>; // keyed by repo path
  }

  // Restore from localStorage
  function loadState(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          tabs: parsed.tabs || [],
          activeTabId: parsed.activeTabId || null,
          branchCache: parsed.branchCache || {},
        };
      }
    } catch {
      // Corrupted state, start fresh
    }
    return { tabs: [], activeTabId: null, branchCache: {} };
  }

  function saveState() {
    const state: AppState = { tabs, activeTabId, branchCache };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage full or unavailable, ignore
    }
  }

  const restored = loadState();
  let tabs: RepoTab[] = restored.tabs;
  let activeTabId: string | null = restored.activeTabId;
  let branchCache: Record<string, BranchInfo[]> = restored.branchCache;

  $: activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Persist whenever tabs or activeTabId change
  $: tabs, activeTabId, saveState();

  function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  async function openRepo() {
    const result = await window.electronAPI.selectDirectory();
    if (!result) return;
    if (result.error) {
      alert(result.error);
      return;
    }

    // Check if already open
    const existing = tabs.find((t) => t.path === result.path);
    if (existing) {
      activeTabId = existing.id;
      return;
    }

    const pathParts = result.path.split('/');
    const name = pathParts[pathParts.length - 1] || result.path;

    const newTab: RepoTab = {
      id: generateId(),
      path: result.path,
      name,
    };

    tabs = [...tabs, newTab];
    activeTabId = newTab.id;
  }

  function closeTab(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      delete branchCache[tab.path];
    }
    tabs = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    saveState();
  }

  function selectTab(tabId: string) {
    activeTabId = tabId;
  }

  function handleBranchesLoaded(repoPath: string, branches: BranchInfo[]) {
    branchCache[repoPath] = branches;
    branchCache = branchCache; // trigger reactivity
    saveState();
  }

  // On startup, background-refresh branches for all non-active tabs
  // (the active tab's BranchView handles its own refresh on mount)
  onMount(() => {
    for (const tab of tabs) {
      if (tab.id !== activeTabId) {
        refreshTabInBackground(tab.path);
      }
    }
  });

  async function refreshTabInBackground(repoPath: string) {
    try {
      const result = await window.electronAPI.getBranches(repoPath);
      if (!result.error && result.branches) {
        branchCache[repoPath] = result.branches;
        branchCache = branchCache;
        saveState();
      }
    } catch {
      // Silently fail for background refresh
    }
  }
</script>

<div class="app">
  <TabBar {tabs} {activeTabId} on:select={(e) => selectTab(e.detail)} on:close={(e) => closeTab(e.detail)} on:open={openRepo} />

  <main class="content">
    {#if activeTab}
      {#key activeTab.id}
        <BranchView
          repoPath={activeTab.path}
          repoName={activeTab.name}
          cachedBranches={branchCache[activeTab.path] || null}
          on:branchesloaded={(e) => handleBranchesLoaded(activeTab.path, e.detail)}
        />
      {/key}
    {:else}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="3" x2="6" y2="15"></line>
            <circle cx="18" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <path d="M18 9a9 9 0 0 1-9 9"></path>
          </svg>
        </div>
        <h2>Git Branch Organiser</h2>
        <p>Open a git repository to manage your local branches</p>
        <button class="btn btn-primary" on:click={openRepo}>Open Repository</button>
      </div>
    {/if}
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1e1e2e;
    color: #cdd6f4;
  }

  .content {
    flex: 1;
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    opacity: 0.7;
  }

  .empty-icon {
    color: #89b4fa;
    margin-bottom: 8px;
  }

  .empty-state h2 {
    font-size: 22px;
    font-weight: 600;
    margin: 0;
    color: #cdd6f4;
  }

  .empty-state p {
    font-size: 14px;
    color: #a6adc8;
    margin: 0;
  }

  :global(.btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s, opacity 0.15s;
  }

  :global(.btn:hover) {
    opacity: 0.9;
  }

  :global(.btn:active) {
    opacity: 0.8;
  }

  :global(.btn-primary) {
    background: #89b4fa;
    color: #1e1e2e;
  }

  :global(.btn-danger) {
    background: #f38ba8;
    color: #1e1e2e;
  }

  :global(.btn-ghost) {
    background: transparent;
    color: #cdd6f4;
    border: 1px solid #45475a;
  }

  :global(.btn-ghost:hover) {
    background: #313244;
  }

  :global(.btn:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
