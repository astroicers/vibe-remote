// Workspace File Watcher — uses chokidar to detect file changes and notify via callback

import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  relativePath: string;
}

type FileChangeCallback = (workspaceId: string, changes: FileChangeEvent[]) => void;

export class WorkspaceWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private pendingChanges: Map<string, FileChangeEvent[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private callback: FileChangeCallback | null = null;
  private debounceMs: number;

  constructor(debounceMs = 300) {
    this.debounceMs = debounceMs;
  }

  onChanges(callback: FileChangeCallback): void {
    this.callback = callback;
  }

  watch(workspaceId: string, workspacePath: string): void {
    // Don't double-watch
    if (this.watchers.has(workspaceId)) return;

    // Read .gitignore patterns for this workspace
    const ignorePatterns = this.getIgnorePatterns(workspacePath);

    const watcher = chokidar.watch(workspacePath, {
      ignored: [
        /(^|[/\\])\./,  // dotfiles
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        ...ignorePatterns,
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    const handleEvent = (type: FileChangeEvent['type'], filePath: string) => {
      const relativePath = path.relative(workspacePath, filePath);

      if (!this.pendingChanges.has(workspaceId)) {
        this.pendingChanges.set(workspaceId, []);
      }
      this.pendingChanges.get(workspaceId)!.push({ type, path: filePath, relativePath });

      // Debounce
      const existing = this.debounceTimers.get(workspaceId);
      if (existing) clearTimeout(existing);

      this.debounceTimers.set(workspaceId, setTimeout(() => {
        const changes = this.pendingChanges.get(workspaceId) || [];
        this.pendingChanges.delete(workspaceId);
        this.debounceTimers.delete(workspaceId);

        if (changes.length > 0 && this.callback) {
          this.callback(workspaceId, changes);
        }
      }, this.debounceMs));
    };

    watcher
      .on('add', (p) => handleEvent('add', p))
      .on('change', (p) => handleEvent('change', p))
      .on('unlink', (p) => handleEvent('unlink', p));

    this.watchers.set(workspaceId, watcher);
    console.log(`[watcher] Watching workspace: ${workspaceId} at ${workspacePath}`);
  }

  unwatch(workspaceId: string): void {
    const watcher = this.watchers.get(workspaceId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(workspaceId);
      this.pendingChanges.delete(workspaceId);
      const timer = this.debounceTimers.get(workspaceId);
      if (timer) clearTimeout(timer);
      this.debounceTimers.delete(workspaceId);
      console.log(`[watcher] Stopped watching workspace: ${workspaceId}`);
    }
  }

  unwatchAll(): void {
    for (const [id] of this.watchers) {
      this.unwatch(id);
    }
  }

  isWatching(workspaceId: string): boolean {
    return this.watchers.has(workspaceId);
  }

  private getIgnorePatterns(workspacePath: string): string[] {
    try {
      const gitignorePath = path.join(workspacePath, '.gitignore');
      if (!fs.existsSync(gitignorePath)) return [];

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(pattern => `**/${pattern}`);
    } catch {
      return [];
    }
  }
}

// Singleton
let instance: WorkspaceWatcher | null = null;

export function getWatcher(): WorkspaceWatcher {
  if (!instance) {
    instance = new WorkspaceWatcher();
  }
  return instance;
}
