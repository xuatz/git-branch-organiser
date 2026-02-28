<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BranchTreeNode } from '../../shared/types';

  export let nodes: BranchTreeNode[] = [];
  export let selectedBranches: Set<string> = new Set();
  export let depth: number = 0;
  export let isRecycleBin: boolean = false;

  const dispatch = createEventDispatcher();

  function toggleExpand(node: BranchTreeNode) {
    node.expanded = !node.expanded;
    nodes = nodes; // trigger reactivity
  }

  function handleBranchClick(name: string, event: MouseEvent) {
    dispatch('branchclick', { name, event });
  }

  function formatDate(isoDate: string): string {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'today';
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return '';
    }
  }

  function statusColor(branch: { ahead: number; behind: number; trackingBranch: string | null }): string {
    if (!branch.trackingBranch) return '#fab387'; // peach - warning
    if (branch.ahead === 0 && branch.behind === 0) return '#a6e3a1'; // green - safe
    if (branch.ahead > 0) return '#f9e2af'; // yellow - has unpushed
    return '#89b4fa'; // blue - behind
  }
</script>

{#each nodes as node (node.name + (node.fullName || ''))}
  {#if node.branch}
    <!-- Leaf node: actual branch -->
    <button
      class="branch-row"
      class:selected={selectedBranches.has(node.fullName || '')}
      class:current={node.branch.isCurrent}
      class:recyclebin={isRecycleBin}
      disabled={node.branch.isCurrent}
      style="padding-left: {16 + depth * 16}px"
      on:click={(e) => !(node.branch && node.branch.isCurrent) && handleBranchClick(node.fullName || '', e)}
    >
      {#if node.branch.isCurrent}
        <span class="current-indicator" title="Current branch">*</span>
      {/if}
      {#if !isRecycleBin && !node.branch.isCurrent}
        <span class="checkbox" class:checked={selectedBranches.has(node.fullName || '')}>
          {#if selectedBranches.has(node.fullName || '')}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {/if}
        </span>
      {/if}
      <div class="branch-main">
        <div class="branch-name-row">
          <span class="branch-name">{node.name}</span>
          <span class="status-dot" style="background: {statusColor(node.branch)}" title={node.branch.statusText}></span>
        </div>
        <div class="branch-meta">
          <span class="status-text">{node.branch.statusText}</span>
          {#if node.branch.lastCommitDate}
            <span class="separator">|</span>
            <span class="commit-date">{formatDate(node.branch.lastCommitDate)}</span>
          {/if}
          {#if node.branch.lastCommitMessage}
            <span class="separator">|</span>
            <span class="commit-msg">{node.branch.lastCommitMessage}</span>
          {/if}
        </div>
      </div>
      {#if node.branch.trackingBranch}
        <div class="ahead-behind">
          {#if node.branch.ahead > 0}
            <span class="ahead" title="{node.branch.ahead} ahead">{node.branch.ahead}&uarr;</span>
          {/if}
          {#if node.branch.behind > 0}
            <span class="behind" title="{node.branch.behind} behind">{node.branch.behind}&darr;</span>
          {/if}
        </div>
      {/if}
    </button>
  {:else}
    <!-- Folder node -->
    <button
      class="folder-row"
      style="padding-left: {16 + depth * 16}px"
      on:click={() => toggleExpand(node)}
    >
      <span class="folder-icon">{node.expanded ? '▾' : '▸'}</span>
      <span class="folder-name">{node.name}/</span>
      <span class="folder-count">{countLeaves(node)}</span>
    </button>
    {#if node.expanded}
      <svelte:self
        nodes={node.children}
        {selectedBranches}
        depth={depth + 1}
        {isRecycleBin}
        on:branchclick
      />
    {/if}
  {/if}
{/each}

<script context="module" lang="ts">
  import type { BranchTreeNode as TreeNode } from '../../shared/types';

  function countLeaves(node: TreeNode): number {
    if (node.branch) return 1;
    return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
  }
</script>

<style>
  .branch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 16px;
    background: transparent;
    border: none;
    color: #cdd6f4;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    gap: 12px;
  }

  .branch-row:hover:not(:disabled) {
    background: #313244;
  }

  .branch-row.selected {
    background: rgba(137, 180, 250, 0.15);
  }

  .branch-row.selected:hover {
    background: rgba(137, 180, 250, 0.2);
  }

  .branch-row.current {
    opacity: 0.5;
    cursor: default;
  }

  .branch-row:disabled {
    cursor: default;
  }

  .branch-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .branch-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .current-indicator {
    color: #a6e3a1;
    font-weight: bold;
    font-size: 14px;
  }

  .checkbox {
    width: 16px;
    height: 16px;
    border: 1.5px solid #45475a;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.1s, border-color 0.1s;
  }

  .checkbox.checked {
    background: #89b4fa;
    border-color: #89b4fa;
    color: #1e1e2e;
  }

  .branch-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .branch-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #6c7086;
  }

  .separator {
    color: #45475a;
  }

  .commit-msg {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .ahead-behind {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .ahead {
    color: #f9e2af;
  }

  .behind {
    color: #89b4fa;
  }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 16px;
    background: transparent;
    border: none;
    color: #a6adc8;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .folder-row:hover {
    background: #313244;
  }

  .folder-icon {
    font-size: 10px;
    width: 12px;
    text-align: center;
    color: #6c7086;
  }

  .folder-name {
    font-weight: 500;
  }

  .folder-count {
    color: #6c7086;
    font-size: 11px;
  }
</style>
