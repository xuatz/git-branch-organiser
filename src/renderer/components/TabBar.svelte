<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { RepoTab } from '../../shared/types';

  export let tabs: RepoTab[] = [];
  export let activeTabId: string | null = null;

  const dispatch = createEventDispatcher<{
    select: string;
    close: string;
    open: void;
  }>();
</script>

<div class="tab-bar">
  <div class="tabs">
    {#each tabs as tab (tab.id)}
      <button
        class="tab"
        class:active={tab.id === activeTabId}
        on:click={() => dispatch('select', tab.id)}
        title={tab.path}
      >
        <span class="tab-name">{tab.name}</span>
        <button
          class="tab-close"
          on:click|stopPropagation={() => dispatch('close', tab.id)}
          title="Close tab"
        >
          &times;
        </button>
      </button>
    {/each}
  </div>
  <button class="add-tab" on:click={() => dispatch('open')} title="Open repository">
    +
  </button>
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    background: #181825;
    border-bottom: 1px solid #313244;
    padding: 0 8px 0 80px;
    height: 40px;
    -webkit-app-region: drag;
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    -webkit-app-region: no-drag;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 6px 6px 0 0;
    color: #a6adc8;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .tab:hover {
    background: #313244;
    color: #cdd6f4;
  }

  .tab.active {
    background: #1e1e2e;
    color: #cdd6f4;
  }

  .tab-name {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #6c7086;
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
  }

  .tab-close:hover {
    background: #45475a;
    color: #f38ba8;
  }

  .add-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    margin-left: 4px;
    background: transparent;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #a6adc8;
    font-size: 16px;
    cursor: pointer;
    -webkit-app-region: no-drag;
    transition: background 0.15s;
  }

  .add-tab:hover {
    background: #313244;
    color: #cdd6f4;
  }
</style>
