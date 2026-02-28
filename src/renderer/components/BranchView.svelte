<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import BranchTree from './BranchTree.svelte';
  import WarningModal from './WarningModal.svelte';
  import type { BranchInfo, BranchTreeNode, BranchWarning } from '../../shared/types';

  export let repoPath: string;
  export let repoName: string;
  export let cachedBranches: BranchInfo[] | null = null;

  const dispatch = createEventDispatcher<{ branchesloaded: BranchInfo[] }>();

  let branches: BranchInfo[] = cachedBranches || [];
  let loading = cachedBranches ? false : true;
  let refreshing = false;
  let error: string | null = null;
  let selectedBranches = new Set<string>();
  let lastClickedBranch: string | null = null;
  let lastClickWasSelect = true; // tracks whether the last click added or removed

  // Warning modal state
  let showWarningModal = false;
  let warnings: BranchWarning[] = [];
  let pendingDeleteBranches: string[] = [];

  // Recycle bin state
  let emptyingRecycleBin = false;

  // Track flat list of selectable branches for shift-click range
  let flatSelectableBranches: string[] = [];

  $: regularBranches = branches.filter((b) => !b.isRecycleBin);
  $: recycleBinBranches = branches.filter((b) => b.isRecycleBin);
  $: recycleBinCount = recycleBinBranches.length;

  $: tree = buildTree(regularBranches);
  $: recycleBinTree = buildTree(recycleBinBranches);
  $: {
    flatSelectableBranches = regularBranches
      .filter((b) => !b.isCurrent)
      .map((b) => b.name);
  }

  function buildTree(branchList: BranchInfo[]): BranchTreeNode[] {
    const root: BranchTreeNode[] = [];

    for (const branch of branchList) {
      const parts = branch.name.split('/');
      let currentLevel = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;

        let existing = currentLevel.find((n) => n.name === part);

        if (!existing) {
          existing = {
            name: part,
            children: [],
            expanded: true,
          };

          if (isLeaf) {
            existing.fullName = branch.name;
            existing.branch = branch;
          }

          currentLevel.push(existing);
        } else if (isLeaf) {
          existing.fullName = branch.name;
          existing.branch = branch;
        }

        currentLevel = existing.children;
      }
    }

    return root;
  }

  async function loadBranches(background = false) {
    if (!background) {
      loading = true;
    }
    refreshing = true;
    error = null;
    try {
      const result = await window.electronAPI.getBranches(repoPath);
      if (result.error) {
        error = result.error;
      } else {
        branches = result.branches;
        dispatch('branchesloaded', result.branches);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  function handleBranchClick(branchName: string, event: MouseEvent) {
    if (event.shiftKey && lastClickedBranch) {
      // Shift+Click: apply the same action (select or deselect) as the last click
      // across the entire range from lastClickedBranch to branchName
      const startIdx = flatSelectableBranches.indexOf(lastClickedBranch);
      const endIdx = flatSelectableBranches.indexOf(branchName);

      if (startIdx !== -1 && endIdx !== -1) {
        const from = Math.min(startIdx, endIdx);
        const to = Math.max(startIdx, endIdx);
        const next = new Set(selectedBranches);
        for (let i = from; i <= to; i++) {
          if (lastClickWasSelect) {
            next.add(flatSelectableBranches[i]);
          } else {
            next.delete(flatSelectableBranches[i]);
          }
        }
        selectedBranches = next;
      }
    } else {
      // Normal click: toggle individual selection
      const next = new Set(selectedBranches);
      const wasSelected = next.has(branchName);
      if (wasSelected) {
        next.delete(branchName);
      } else {
        next.add(branchName);
      }
      selectedBranches = next;
      lastClickedBranch = branchName;
      lastClickWasSelect = !wasSelected;
    }
  }

  function selectAll() {
    selectedBranches = new Set(flatSelectableBranches);
  }

  function deselectAll() {
    selectedBranches = new Set();
    lastClickedBranch = null;
  }

  async function handleDelete() {
    if (selectedBranches.size === 0) return;

    const branchNames = Array.from(selectedBranches);
    pendingDeleteBranches = branchNames;

    // Get warnings
    try {
      const result = await window.electronAPI.getBranchWarnings(repoPath, branchNames);
      if (result.warnings && result.warnings.length > 0) {
        warnings = result.warnings;
        showWarningModal = true;
        return;
      }
    } catch {
      // If we can't get warnings, proceed anyway
    }

    await performSoftDelete(branchNames);
  }

  async function performSoftDelete(branchNames: string[]) {
    showWarningModal = false;
    try {
      const result = await window.electronAPI.softDelete(repoPath, branchNames);
      if (result.errors && result.errors.length > 0) {
        const errMessages = result.errors.map((e: { branch: string; error: string }) => `${e.branch}: ${e.error}`).join('\n');
        alert(`Some branches could not be moved to recycle bin:\n${errMessages}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    selectedBranches = new Set();
    lastClickedBranch = null;
    await loadBranches();
  }

  function handleWarningConfirm() {
    performSoftDelete(pendingDeleteBranches);
  }

  function handleWarningCancel() {
    showWarningModal = false;
    pendingDeleteBranches = [];
    warnings = [];
  }

  async function handleEmptyRecycleBin() {
    if (recycleBinCount === 0) return;

    const confirmed = confirm(
      `Permanently delete ${recycleBinCount} branch${recycleBinCount > 1 ? 'es' : ''} from the recycle bin? This cannot be undone.`,
    );
    if (!confirmed) return;

    emptyingRecycleBin = true;
    try {
      const result = await window.electronAPI.emptyRecycleBin(repoPath);
      if (result.errors && result.errors.length > 0) {
        const errMessages = result.errors.map((e: { branch: string; error: string }) => `${e.branch}: ${e.error}`).join('\n');
        alert(`Some branches could not be deleted:\n${errMessages}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      emptyingRecycleBin = false;
    }
    await loadBranches();
  }

  onMount(() => {
    // If we have cached data, refresh in background; otherwise do a full load
    loadBranches(cachedBranches !== null && cachedBranches.length > 0);
  });
</script>

<div class="branch-view">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading branches...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <p>Error: {error}</p>
      <button class="btn btn-primary" on:click={() => loadBranches()}>Retry</button>
    </div>
  {:else}
    <div class="toolbar">
      <div class="toolbar-left">
        <h3 class="repo-title">{repoName}</h3>
        <span class="branch-count">{regularBranches.length} branches</span>
        {#if refreshing}
          <div class="refreshing-indicator" title="Refreshing branches...">
            <div class="spinner-sm"></div>
          </div>
        {/if}
      </div>
      <div class="toolbar-right">
        <button class="btn btn-ghost" on:click={() => loadBranches()} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
        <button class="btn btn-ghost" on:click={selectAll} disabled={flatSelectableBranches.length === 0}>
          Select All
        </button>
        <button class="btn btn-ghost" on:click={deselectAll} disabled={selectedBranches.size === 0}>
          Deselect All
        </button>
        <button
          class="btn btn-danger"
          on:click={handleDelete}
          disabled={selectedBranches.size === 0}
        >
          Move to Recycle Bin ({selectedBranches.size})
        </button>
      </div>
    </div>

    <div class="panels">
      <div class="branch-panel">
        <BranchTree
          nodes={tree}
          {selectedBranches}
          on:branchclick={(e) => handleBranchClick(e.detail.name, e.detail.event)}
        />
        {#if regularBranches.length === 0}
          <div class="empty-panel">
            <p>No branches found</p>
          </div>
        {/if}
      </div>

      <div class="recycle-panel">
        <div class="recycle-header">
          <div class="recycle-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Recycle Bin</span>
            <span class="recycle-count">{recycleBinCount}</span>
          </div>
          <button
            class="btn btn-danger btn-sm"
            on:click={handleEmptyRecycleBin}
            disabled={recycleBinCount === 0 || emptyingRecycleBin}
          >
            {#if emptyingRecycleBin}
              <div class="spinner-sm"></div>
              Emptying...
            {:else}
              Empty Recycle Bin
            {/if}
          </button>
        </div>
        <div class="recycle-content">
          {#if recycleBinCount > 0}
            <BranchTree
              nodes={recycleBinTree}
              selectedBranches={new Set()}
              isRecycleBin={true}
              on:branchclick={() => {}}
            />
          {:else}
            <div class="empty-panel">
              <p>Recycle bin is empty</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if showWarningModal}
    <WarningModal
      {warnings}
      branchCount={pendingDeleteBranches.length}
      on:confirm={handleWarningConfirm}
      on:cancel={handleWarningCancel}
    />
  {/if}
</div>

<style>
  .branch-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: #a6adc8;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: #f38ba8;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #313244;
    flex-shrink: 0;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .repo-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .branch-count {
    font-size: 12px;
    color: #a6adc8;
    background: #313244;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .panels {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .branch-panel {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .recycle-panel {
    width: 300px;
    border-left: 1px solid #313244;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .recycle-header {
    padding: 12px 16px;
    border-bottom: 1px solid #313244;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recycle-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #a6adc8;
  }

  .recycle-count {
    background: #45475a;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
  }

  .recycle-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .empty-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: #6c7086;
    font-size: 13px;
  }

  .empty-panel p {
    margin: 0;
  }

  :global(.btn-sm) {
    padding: 4px 10px;
    font-size: 11px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #313244;
    border-top: 3px solid #89b4fa;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-sm {
    width: 12px;
    height: 12px;
    border: 2px solid #313244;
    border-top: 2px solid #1e1e2e;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
