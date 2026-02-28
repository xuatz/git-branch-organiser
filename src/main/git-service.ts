import simpleGit, { SimpleGit } from "simple-git";
import {
  BranchInfo,
  BranchWarning,
  SoftDeleteResult,
  EmptyRecycleBinResult,
} from "../shared/types";

const RECYCLE_BIN_PREFIX = "recyclebin";

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /** Verify this is a valid git repository */
  async validate(): Promise<boolean> {
    try {
      const isRepo = await this.git.checkIsRepo();
      return isRepo;
    } catch {
      return false;
    }
  }

  /** Find an available recycle bin prefix that doesn't conflict with existing branches */
  private async findRecycleBinPrefix(): Promise<string> {
    const branches = await this.git.branchLocal();
    const allNames = branches.all;

    // Check if a branch literally named "recyclebin" exists (not "recyclebin/...")
    // We need to avoid conflicts where a branch named "recyclebin" would prevent
    // creating "recyclebin/foo" since git uses filesystem-like naming.
    let prefix = RECYCLE_BIN_PREFIX;
    let counter = 1;

    while (true) {
      const conflicting = allNames.some((name) => name === prefix);
      if (!conflicting) {
        return prefix;
      }
      counter++;
      prefix = `${RECYCLE_BIN_PREFIX}${counter}`;
    }
  }

  /** Get all local branches with their status info — single batched git command */
  async getBranches(): Promise<BranchInfo[]> {
    // We still need branchLocal() to know which branch is currently checked out
    const branches = await this.git.branchLocal();
    const currentBranch = branches.current;

    // Single for-each-ref call to get ALL branch data at once
    // Using a string delimiter that won't appear in branch names or commit messages
    const DELIM = "@@DELIM@@";
    const format = [
      "%(refname:short)", // branch name
      "%(upstream:short)", // tracking branch
      "%(upstream:track)", // ahead/behind info like [ahead 2, behind 3]
      "%(committerdate:iso)", // last commit date
      "%(subject)", // last commit message
    ].join(DELIM);

    let refOutput: string;
    try {
      refOutput = await this.git.raw(["for-each-ref", `--format=${format}`, "refs/heads/"]);
    } catch {
      return [];
    }

    const results: BranchInfo[] = [];
    const lines = refOutput.trim().split("\n");

    for (const line of lines) {
      if (!line) continue;

      const parts = line.split(DELIM);
      const branchName = parts[0] || "";
      if (!branchName) continue;

      const trackingRaw = parts[1] || "";
      const trackInfo = parts[2] || "";
      const commitDate = parts[3] || "";
      const commitMessage = parts[4] || "";

      // Parse ahead/behind from track info like "[ahead 2, behind 3]"
      let ahead = 0;
      let behind = 0;
      const aheadMatch = trackInfo.match(/ahead (\d+)/);
      const behindMatch = trackInfo.match(/behind (\d+)/);
      if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
      if (behindMatch) behind = parseInt(behindMatch[1], 10);

      const isGone = trackInfo.includes("gone");
      const trackingBranch = trackingRaw && !isGone ? trackingRaw : null;

      const isCurrent = branchName === currentBranch;
      const isRecycleBin =
        branchName.startsWith(`${RECYCLE_BIN_PREFIX}/`) || /^recyclebin\d+\//.test(branchName);

      const statusText = this.generateStatusText(trackingBranch, ahead, behind, isGone);

      results.push({
        name: branchName,
        isCurrent,
        trackingBranch,
        ahead,
        behind,
        statusText,
        lastCommitDate: commitDate,
        lastCommitMessage: commitMessage,
        isRecycleBin,
      });
    }

    // Sort alphabetically
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }

  /** Generate human-readable status text */
  private generateStatusText(
    trackingBranch: string | null,
    ahead: number,
    behind: number,
    isGone: boolean = false,
  ): string {
    if (isGone) {
      return "Remote branch deleted";
    }

    if (!trackingBranch) {
      return "No remote tracking branch (local only)";
    }

    if (ahead === 0 && behind === 0) {
      return "Up to date with remote";
    }

    const parts: string[] = [];
    if (ahead > 0) {
      parts.push(`${ahead} unpushed commit${ahead > 1 ? "s" : ""}`);
    }
    if (behind > 0) {
      parts.push(`${behind} commit${behind > 1 ? "s" : ""} behind remote`);
    }

    return parts.join(", ");
  }

  /** Get warnings for branches about to be soft-deleted — single batched git command */
  async getBranchWarnings(branchNames: string[]): Promise<BranchWarning[]> {
    const DELIM = "@@DELIM@@";

    // Single call to get tracking + ahead/behind for all branches
    const refOutput = await this.git.raw([
      "for-each-ref",
      `--format=%(refname:short)${DELIM}%(upstream:short)${DELIM}%(upstream:track)`,
      "refs/heads/",
    ]);

    const branchMap = new Map<string, { tracking: string; trackInfo: string }>();
    const lines = refOutput.trim().split("\n");
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split(DELIM);
      branchMap.set(parts[0], {
        tracking: parts[1] || "",
        trackInfo: parts[2] || "",
      });
    }

    const warnings: BranchWarning[] = [];

    for (const name of branchNames) {
      const reasons: string[] = [];
      const info = branchMap.get(name);

      if (!info || !info.tracking) {
        reasons.push(
          "No remote tracking branch — this branch is local only and has never been pushed",
        );
      } else if (info.trackInfo.includes("gone")) {
        reasons.push("Remote tracking branch has been deleted");
      } else {
        const aheadMatch = info.trackInfo.match(/ahead (\d+)/);
        if (aheadMatch) {
          const ahead = parseInt(aheadMatch[1], 10);
          if (ahead > 0) {
            reasons.push(`${ahead} unpushed commit${ahead > 1 ? "s" : ""} that exist only locally`);
          }
        }
      }

      if (reasons.length > 0) {
        warnings.push({ name, reasons });
      }
    }

    return warnings;
  }

  /** Soft delete branches by renaming them to recyclebin/... */
  async softDelete(branchNames: string[]): Promise<SoftDeleteResult> {
    const prefix = await this.findRecycleBinPrefix();
    const moved: string[] = [];
    const errors: { branch: string; error: string }[] = [];

    for (const name of branchNames) {
      const newName = `${prefix}/${name}`;
      try {
        await this.git.raw(["branch", "-m", name, newName]);
        moved.push(name);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ branch: name, error: message });
      }
    }

    return {
      success: errors.length === 0,
      moved,
      errors,
    };
  }

  /** Permanently delete all branches in the recycle bin */
  async emptyRecycleBin(): Promise<EmptyRecycleBinResult> {
    const branches = await this.git.branchLocal();
    const recycleBinBranches = branches.all.filter(
      (name) =>
        name.startsWith(`${RECYCLE_BIN_PREFIX}/`) || name.match(/^recyclebin\d+\//) !== null,
    );

    const deleted: string[] = [];
    const errors: { branch: string; error: string }[] = [];

    for (const name of recycleBinBranches) {
      try {
        // Use -D to force delete even if not merged
        await this.git.raw(["branch", "-D", name]);
        deleted.push(name);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ branch: name, error: message });
      }
    }

    return {
      success: errors.length === 0,
      deleted,
      errors,
    };
  }
}
