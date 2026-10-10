/**
 * ReviewGround - Lightweight Repo Context Grounder
 * Extracts sibling file and directory structures for modified files in the diff.
 * Informs LLMs of existing project utilities and modules to eliminate "duplicate utility" hallucinations.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RepoContextOptions {
  maxDirs?: number;
  maxFilesPerDir?: number;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  'vendor',
  '__pycache__',
]);

/**
 * Extracts changed file paths from a unified diff text.
 */
export function extractChangedFilesFromDiff(diffText: string): string[] {
  if (!diffText) return [];
  const files: string[] = [];
  const regex = /^diff --git a\/(.+?) b\//gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(diffText)) !== null) {
    if (match[1] && !files.includes(match[1])) {
      files.push(match[1]);
    }
  }
  return files;
}

/**
 * Builds a compact summary of existing sibling files in the directories touched by the diff.
 */
export function buildRepoContext(
  diffText: string,
  options: RepoContextOptions = {}
): string {
  const maxDirs = options.maxDirs ?? 5;
  const maxFilesPerDir = options.maxFilesPerDir ?? 8;

  const changedFiles = extractChangedFilesFromDiff(diffText);
  if (changedFiles.length === 0) return '';

  const parentDirs = new Set<string>();
  for (const file of changedFiles) {
    const dir = path.dirname(file);
    if (dir && dir !== '.' && !IGNORED_DIRS.has(dir.split(path.sep)[0])) {
      parentDirs.add(dir);
    }
  }

  if (parentDirs.size === 0) return '';

  const dirOutlines: string[] = [];
  let count = 0;

  for (const dir of parentDirs) {
    if (count >= maxDirs) break;
    if (!fs.existsSync(dir)) continue;

    try {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) continue;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const siblingFiles = entries
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .slice(0, maxFilesPerDir);

      if (siblingFiles.length > 0) {
        dirOutlines.push(`- ${dir}/: [${siblingFiles.join(', ')}]`);
        count++;
      }
    } catch {
      // Ignore unreadable or protected directories
    }
  }

  if (dirOutlines.length === 0) return '';

  return (
    `\nExisting Project Structure (Relevant Directories):\n` +
    dirOutlines.join('\n') +
    `\n(Leverage existing utilities and modules shown above; avoid reinventing duplicate helper functions.)\n`
  );
}
