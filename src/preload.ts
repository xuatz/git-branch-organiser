import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./shared/types";

const api = {
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),

  openRepo: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_REPO, repoPath),

  getBranches: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_BRANCHES, repoPath),

  getBranchWarnings: (repoPath: string, branchNames: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BRANCH_WARNINGS, repoPath, branchNames),

  softDelete: (repoPath: string, branchNames: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SOFT_DELETE, repoPath, branchNames),

  emptyRecycleBin: (repoPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EMPTY_RECYCLE_BIN, repoPath),
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld("electronAPI", api);
