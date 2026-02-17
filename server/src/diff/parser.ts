// Diff Parser - Parse git diff output into structured format

import type { FileDiff, DiffHunk, DiffSummary } from './types.js';

/**
 * Parse git diff output into structured FileDiff objects
 */
export function parseDiff(diffOutput: string): DiffSummary {
  const files: FileDiff[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  if (!diffOutput.trim()) {
    return { files, totalInsertions, totalDeletions, totalFiles: 0 };
  }

  // Split by file diff headers
  const fileDiffs = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const fileDiff of fileDiffs) {
    const parsed = parseFileDiff('diff --git ' + fileDiff);
    if (parsed) {
      files.push(parsed);
      totalInsertions += parsed.insertions;
      totalDeletions += parsed.deletions;
    }
  }

  return {
    files,
    totalInsertions,
    totalDeletions,
    totalFiles: files.length,
  };
}

function parseFileDiff(content: string): FileDiff | null {
  const lines = content.split('\n');

  // Parse header: diff --git a/path b/path
  const headerMatch = lines[0]?.match(/^diff --git a\/(.+) b\/(.+)$/);
  if (!headerMatch) return null;

  const oldPath = headerMatch[1];
  const newPath = headerMatch[2];

  let status: FileDiff['status'] = 'modified';
  let isBinary = false;
  let insertions = 0;
  let deletions = 0;
  const hunks: DiffHunk[] = [];

  // Parse metadata lines
  let lineIndex = 1;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line.startsWith('new file mode')) {
      status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      status = 'deleted';
    } else if (line.startsWith('rename from')) {
      status = 'renamed';
    } else if (line.startsWith('Binary files')) {
      isBinary = true;
    } else if (line.startsWith('@@')) {
      // Start of hunks
      break;
    }

    lineIndex++;
  }

  // Parse hunks
  let currentHunk: DiffHunk | null = null;
  let hunkContent: string[] = [];

  for (let i = lineIndex; i < lines.length; i++) {
    const line = lines[i];

    // Hunk header: @@ -start,lines +start,lines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      // Save previous hunk
      if (currentHunk) {
        currentHunk.content = hunkContent.join('\n');
        hunks.push(currentHunk);
      }

      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        content: '',
      };
      hunkContent = [line];
    } else if (currentHunk) {
      hunkContent.push(line);

      // Count insertions and deletions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
  }

  // Save last hunk
  if (currentHunk) {
    currentHunk.content = hunkContent.join('\n');
    hunks.push(currentHunk);
  }

  return {
    path: newPath,
    oldPath: oldPath !== newPath ? oldPath : undefined,
    status,
    insertions,
    deletions,
    hunks,
    isBinary,
  };
}

/**
 * Format a diff summary for display
 */
export function formatDiffSummary(summary: DiffSummary): string {
  const lines: string[] = [];

  lines.push(`${summary.totalFiles} file(s) changed`);
  lines.push(`+${summary.totalInsertions} insertions, -${summary.totalDeletions} deletions`);
  lines.push('');

  for (const file of summary.files) {
    const statusIcon = {
      added: '+',
      modified: 'M',
      deleted: '-',
      renamed: 'R',
    }[file.status];

    lines.push(`${statusIcon} ${file.path} (+${file.insertions}/-${file.deletions})`);
  }

  return lines.join('\n');
}

/**
 * Generate a unified diff view for a single file
 */
export function generateUnifiedView(file: FileDiff): string {
  if (file.isBinary) {
    return `Binary file ${file.path}`;
  }

  const lines: string[] = [];
  lines.push(`--- a/${file.oldPath || file.path}`);
  lines.push(`+++ b/${file.path}`);

  for (const hunk of file.hunks) {
    lines.push(hunk.content);
  }

  return lines.join('\n');
}
