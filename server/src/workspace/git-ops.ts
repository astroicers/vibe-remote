import simpleGit, { type SimpleGit, type StatusResult } from 'simple-git';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  isClean: boolean;
  isGitRepo: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

function getGit(workspacePath: string): SimpleGit {
  return simpleGit(workspacePath);
}

export async function isGitRepo(workspacePath: string): Promise<boolean> {
  const gitDir = join(workspacePath, '.git');
  return existsSync(gitDir);
}

export async function getGitStatus(workspacePath: string): Promise<GitStatus> {
  if (!(await isGitRepo(workspacePath))) {
    return {
      branch: '',
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      isClean: true,
      isGitRepo: false,
    };
  }

  const git = getGit(workspacePath);

  try {
    const status: StatusResult = await git.status();

    return {
      branch: status.current || 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged.length,
      unstaged: status.modified.length + status.deleted.length,
      untracked: status.not_added.length,
      isClean: status.isClean(),
      isGitRepo: true,
    };
  } catch (error) {
    console.error('Git status error:', error);
    return {
      branch: '',
      ahead: 0,
      behind: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      isClean: true,
      isGitRepo: true,
    };
  }
}

export async function getGitDiff(workspacePath: string, staged = false): Promise<string> {
  const git = getGit(workspacePath);

  try {
    let diffOutput: string;
    if (staged) {
      diffOutput = await git.diff(['--cached']);
    } else {
      diffOutput = await git.diff();
    }

    // Also include untracked (new) files, respecting .gitignore
    const untrackedRaw = await git.raw(['ls-files', '--others', '--exclude-standard']);
    const untrackedFiles = untrackedRaw.trim().split('\n').filter(Boolean);

    if (untrackedFiles.length > 0) {
      const untrackedDiffs = generateUntrackedDiffs(workspacePath, untrackedFiles);
      if (untrackedDiffs) {
        diffOutput = diffOutput ? diffOutput + '\n' + untrackedDiffs : untrackedDiffs;
      }
    }

    return diffOutput;
  } catch (error) {
    console.error('Git diff error:', error);
    return '';
  }
}

/**
 * Generate synthetic diff output for untracked files (shown as new files with all lines added)
 */
function generateUntrackedDiffs(workspacePath: string, files: string[]): string {
  const diffs: string[] = [];

  for (const filePath of files) {
    const fullPath = join(workspacePath, filePath);
    if (!existsSync(fullPath)) continue;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      // Skip binary files (simple heuristic: check for null bytes)
      if (content.includes('\0')) {
        diffs.push(
          `diff --git a/${filePath} b/${filePath}\n` +
          `new file mode 100644\n` +
          `Binary files /dev/null and b/${filePath} differ`
        );
        continue;
      }

      const lines = content.split('\n');
      // Remove trailing empty line that split creates
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      const lineCount = lines.length;
      const addedLines = lines.map(l => '+' + l).join('\n');

      diffs.push(
        `diff --git a/${filePath} b/${filePath}\n` +
        `new file mode 100644\n` +
        `--- /dev/null\n` +
        `+++ b/${filePath}\n` +
        `@@ -0,0 +1,${lineCount} @@\n` +
        addedLines
      );
    } catch {
      // Skip files that can't be read (e.g., permissions)
      continue;
    }
  }

  return diffs.join('\n');
}

export async function getRecentCommits(workspacePath: string, count = 10): Promise<GitCommit[]> {
  const git = getGit(workspacePath);

  try {
    const log = await git.log({ maxCount: count });

    return log.all.map(commit => ({
      hash: commit.hash.substring(0, 7),
      message: commit.message,
      author: commit.author_name,
      date: commit.date,
    }));
  } catch (error) {
    console.error('Git log error:', error);
    return [];
  }
}

export async function gitCommit(workspacePath: string, message: string): Promise<string> {
  const git = getGit(workspacePath);
  const result = await git.commit(message);
  return result.commit;
}

export async function gitPush(workspacePath: string): Promise<void> {
  const git = getGit(workspacePath);
  await git.push();
}

export async function gitPull(workspacePath: string): Promise<void> {
  const git = getGit(workspacePath);
  await git.pull();
}

export async function gitCheckout(workspacePath: string, branch: string, create = false): Promise<void> {
  const git = getGit(workspacePath);

  if (create) {
    await git.checkoutBranch(branch, 'HEAD');
  } else {
    await git.checkout(branch);
  }
}

export async function listBranches(workspacePath: string): Promise<{ current: string; all: string[] }> {
  const git = getGit(workspacePath);
  const summary = await git.branchLocal();

  return {
    current: summary.current,
    all: summary.all,
  };
}

export async function stageFiles(workspacePath: string, files: string[]): Promise<void> {
  const git = getGit(workspacePath);
  await git.add(files);
}

export async function unstageFiles(workspacePath: string, files: string[]): Promise<void> {
  const git = getGit(workspacePath);
  await git.reset(['HEAD', '--', ...files]);
}

export async function discardChanges(workspacePath: string, files: string[]): Promise<void> {
  const git = getGit(workspacePath);
  await git.checkout(['--', ...files]);
}
