/** Information about a single git branch */
export interface BranchInfo {
  /** Full branch name, e.g. "feature/auth/login" */
  name: string;
  /** Whether this is the currently checked out branch */
  isCurrent: boolean;
  /** Remote tracking branch name, or null if none */
  trackingBranch: string | null;
  /** Number of commits ahead of the remote tracking branch */
  ahead: number;
  /** Number of commits behind the remote tracking branch */
  behind: number;
  /** Human-readable status description */
  statusText: string;
  /** Last commit date (ISO string) */
  lastCommitDate: string;
  /** Last commit message (first line) */
  lastCommitMessage: string;
  /** Whether it's in the recycle bin */
  isRecycleBin: boolean;
}

/** A node in the branch tree (folder or leaf) */
export interface BranchTreeNode {
  /** Display name of this segment */
  name: string;
  /** Full branch name (only set on leaf nodes) */
  fullName?: string;
  /** Branch info (only set on leaf nodes) */
  branch?: BranchInfo;
  /** Child nodes (folders) */
  children: BranchTreeNode[];
  /** Whether this node is expanded in the UI */
  expanded?: boolean;
}

/** Represents one open repository tab */
export interface RepoTab {
  /** Unique ID for this tab */
  id: string;
  /** Filesystem path to the repo */
  path: string;
  /** Display name (basename of path) */
  name: string;
}

/** Result of a soft delete operation */
export interface SoftDeleteResult {
  success: boolean;
  /** Branches that were moved to recycle bin */
  moved: string[];
  /** Branches that failed with error messages */
  errors: { branch: string; error: string }[];
}

/** Result of emptying the recycle bin */
export interface EmptyRecycleBinResult {
  success: boolean;
  deleted: string[];
  errors: { branch: string; error: string }[];
}

/** Warning info for branches about to be deleted */
export interface BranchWarning {
  name: string;
  reasons: string[];
}

/** IPC channel names */
export const IPC_CHANNELS = {
  OPEN_REPO: "git:open-repo",
  GET_BRANCHES: "git:get-branches",
  SOFT_DELETE: "git:soft-delete",
  EMPTY_RECYCLE_BIN: "git:empty-recycle-bin",
  GET_BRANCH_WARNINGS: "git:get-branch-warnings",
  SELECT_DIRECTORY: "dialog:select-directory",
} as const;
