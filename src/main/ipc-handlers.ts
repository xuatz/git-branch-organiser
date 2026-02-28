import { ipcMain, dialog, BrowserWindow } from "electron";
import { GitService } from "./git-service";
import { IPC_CHANNELS } from "../shared/types";

/** Map of repo path -> GitService instance */
const services = new Map<string, GitService>();

function getService(repoPath: string): GitService {
  if (!services.has(repoPath)) {
    services.set(repoPath, new GitService(repoPath));
  }
  return services.get(repoPath)!;
}

export function registerIpcHandlers(): void {
  // Open directory picker
  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select a Git Repository",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const dirPath = result.filePaths[0];
    const service = getService(dirPath);
    const isValid = await service.validate();

    if (!isValid) {
      return { error: "Selected directory is not a git repository" };
    }

    return { path: dirPath };
  });

  // Validate and open a repo
  ipcMain.handle(IPC_CHANNELS.OPEN_REPO, async (_event, repoPath: string) => {
    const service = getService(repoPath);
    const isValid = await service.validate();

    if (!isValid) {
      return { error: "Not a valid git repository" };
    }

    return { success: true };
  });

  // Get all branches for a repo
  ipcMain.handle(IPC_CHANNELS.GET_BRANCHES, async (_event, repoPath: string) => {
    try {
      const service = getService(repoPath);
      const branches = await service.getBranches();
      return { branches };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // Get warnings for branches about to be deleted
  ipcMain.handle(
    IPC_CHANNELS.GET_BRANCH_WARNINGS,
    async (_event, repoPath: string, branchNames: string[]) => {
      try {
        const service = getService(repoPath);
        const warnings = await service.getBranchWarnings(branchNames);
        return { warnings };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    },
  );

  // Soft delete branches
  ipcMain.handle(
    IPC_CHANNELS.SOFT_DELETE,
    async (_event, repoPath: string, branchNames: string[]) => {
      try {
        const service = getService(repoPath);
        const result = await service.softDelete(branchNames);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, moved: [], errors: [{ branch: "*", error: message }] };
      }
    },
  );

  // Empty recycle bin
  ipcMain.handle(IPC_CHANNELS.EMPTY_RECYCLE_BIN, async (_event, repoPath: string) => {
    try {
      const service = getService(repoPath);
      const result = await service.emptyRecycleBin();
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, deleted: [], errors: [{ branch: "*", error: message }] };
    }
  });
}
