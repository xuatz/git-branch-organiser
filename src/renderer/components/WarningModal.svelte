<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BranchWarning } from '../../shared/types';

  export let warnings: BranchWarning[] = [];
  export let branchCount: number = 0;

  const dispatch = createEventDispatcher();

  const safeCount = branchCount - warnings.length;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={() => dispatch('cancel')}>
  <div class="modal" on:click|stopPropagation>
    <div class="modal-header">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f9e2af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <h3>Warning</h3>
    </div>

    <div class="modal-body">
      <p>
        You are about to move <strong>{branchCount}</strong> branch{branchCount > 1 ? 'es' : ''} to the recycle bin.
        {#if warnings.length > 0}
          <strong>{warnings.length}</strong> of them {warnings.length > 1 ? 'have' : 'has'} potential issues:
        {/if}
      </p>

      {#if warnings.length > 0}
        <div class="warning-list">
          {#each warnings as warning}
            <div class="warning-item">
              <span class="warning-branch">{warning.name}</span>
              <ul>
                {#each warning.reasons as reason}
                  <li>{reason}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}

      {#if safeCount > 0}
        <p class="safe-note">{safeCount} other branch{safeCount > 1 ? 'es' : ''} can be safely moved.</p>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" on:click={() => dispatch('cancel')}>Cancel</button>
      <button class="btn btn-danger" on:click={() => dispatch('confirm')}>
        Move to Recycle Bin Anyway
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 12px;
    width: 480px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border-bottom: 1px solid #313244;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: #f9e2af;
  }

  .modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.6;
  }

  .modal-body p {
    margin: 0 0 12px;
  }

  .warning-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 8px 0;
  }

  .warning-item {
    background: rgba(249, 226, 175, 0.08);
    border: 1px solid rgba(249, 226, 175, 0.2);
    border-radius: 6px;
    padding: 8px 12px;
  }

  .warning-branch {
    font-weight: 600;
    font-family: monospace;
    font-size: 12px;
    color: #f9e2af;
  }

  .warning-item ul {
    margin: 4px 0 0;
    padding-left: 20px;
  }

  .warning-item li {
    color: #a6adc8;
    font-size: 12px;
  }

  .safe-note {
    color: #a6e3a1;
    font-size: 12px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid #313244;
  }
</style>
