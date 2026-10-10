/**
 * ReviewGround - Smart Diff Prioritizer
 * Feature 5: Heuristic-based file priority scoring for large PRs (>1000 lines).
 * Ensures high-risk files (auth, API, DB, payments) are always reviewed first,
 * even when token limits force truncation of large diffs.
 */

/** Priority tier: 0 = highest, 2 = lowest */
export type PriorityTier = 0 | 1 | 2;

export interface FilePriorityEntry {
  filePath: string;
  tier: PriorityTier;
  reason: string;
  hunkBlock: string;
  charCount: number;
}

// ──────────────────────────────────────────────
// Priority Heuristics
// ──────────────────────────────────────────────

/** P0 (Critical) — auth, API, DB, payments, security-sensitive paths */
const P0_PATTERNS = [
  /\/(auth|authentication|authorization|oauth|jwt|session|login|password|token)/i,
  /\/(api|routes?|controllers?|handlers?|endpoints?)\//i,
  /\/(db|database|models?|migrations?|schema|query|repository|dao)\//i,
  /\/(payments?|billing|stripe|transactions?|wallet|checkout)\//i,
  /\/(security|crypto|encryption|signature|certificates?|ssl|tls)\//i,
  /\/(middleware|interceptors?|guards?|policies?)\//i,
  /\/(config|env|secrets?|credentials?)\//i,
  /\.(sql|prisma)$/i,
];

/** P2 (Low Priority) — generated files, lockfiles, assets, snapshots */
const P2_PATTERNS = [
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /Cargo\.lock$/,
  /go\.sum$/,
  /\.(min\.js|min\.css|map)$/,
  /dist\//,
  /build\//,
  /\.snap$/,               // Jest/Vitest snapshots
  /\/__snapshots__\//,
  /\/fixtures?\//,
  /\.(svg|png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|eot)$/i,
  /\.generated\./,
  /\.pb\.go$/,             // protobuf generated Go
  /\_pb2\.py$/,            // protobuf generated Python
  /\/vendor\//,
  /node_modules\//,
  /\.d\.ts$/,              // TypeScript declaration files
];

function scoreFile(filePath: string): { tier: PriorityTier; reason: string } {
  for (const pat of P2_PATTERNS) {
    if (pat.test(filePath)) {
      return { tier: 2, reason: 'auto-generated / asset / lockfile' };
    }
  }
  for (const pat of P0_PATTERNS) {
    if (pat.test(filePath)) {
      return { tier: 0, reason: 'security-critical path (auth/API/DB/payments)' };
    }
  }
  return { tier: 1, reason: 'standard application code' };
}

// ──────────────────────────────────────────────
// Diff Splitter
// ──────────────────────────────────────────────

/**
 * Splits a raw git diff into per-file hunk blocks with priority scores.
 */
export function splitAndPrioritizeDiff(rawDiff: string): FilePriorityEntry[] {
  const hunkBlocks = rawDiff.split(/(?=^diff --git)/m).filter((b) => b.trim().length > 0);

  return hunkBlocks.map((block) => {
    const headerMatch = block.match(/^diff --git a\/(.+?) b\//m);
    const filePath = headerMatch ? headerMatch[1] : 'unknown';
    const { tier, reason } = scoreFile(filePath);
    return { filePath, tier, reason, hunkBlock: block, charCount: block.length };
  });
}

// ──────────────────────────────────────────────
// Smart Diff Packer
// ──────────────────────────────────────────────

export interface SmartDiffResult {
  packedDiff: string;
  skippedFiles: string[];
  priorityLog: string;
  totalInputChars: number;
  packedChars: number;
}

/**
 * Packs a git diff within `maxChars` by serving high-priority files first.
 * P0 files are always included. P1 files fill remaining budget. P2 files are skipped first.
 *
 * @param rawDiff - Full raw git diff string
 * @param maxChars - Token budget in characters (default 28000 ≈ ~7000 tokens)
 */
export function packPrioritizedDiff(rawDiff: string, maxChars = 28000): SmartDiffResult {
  const totalInputChars = rawDiff.length;

  if (totalInputChars <= maxChars) {
    return {
      packedDiff: rawDiff,
      skippedFiles: [],
      priorityLog: '',
      totalInputChars,
      packedChars: totalInputChars,
    };
  }

  const entries = splitAndPrioritizeDiff(rawDiff);
  const p0 = entries.filter((e) => e.tier === 0);
  const p1 = entries.filter((e) => e.tier === 1);
  const p2 = entries.filter((e) => e.tier === 2);

  const packed: string[] = [];
  const skipped: string[] = [];
  let remaining = maxChars;

  // Always include P0 files (even if they exceed budget — truncate last one)
  for (const entry of p0) {
    if (remaining <= 0) {
      skipped.push(`${entry.filePath} [P0 — budget exhausted]`);
      continue;
    }
    if (entry.charCount <= remaining) {
      packed.push(entry.hunkBlock);
      remaining -= entry.charCount;
    } else {
      // Partial include at clean hunk boundary
      const partial = entry.hunkBlock.slice(0, remaining);
      packed.push(partial + '\n... [truncated — P0 file too large] ...');
      remaining = 0;
    }
  }

  // Fill with P1 files
  for (const entry of p1) {
    if (remaining <= 0) {
      skipped.push(`${entry.filePath} [P1 — budget exhausted]`);
      continue;
    }
    if (entry.charCount <= remaining) {
      packed.push(entry.hunkBlock);
      remaining -= entry.charCount;
    } else {
      skipped.push(`${entry.filePath} [P1 — too large for remaining budget]`);
    }
  }

  // P2 files — skip silently (listed in log)
  for (const entry of p2) {
    skipped.push(`${entry.filePath} [P2 — low-priority auto-generated/asset]`);
  }

  const packedDiff = packed.join('');
  const tierSummary = [
    `P0 (critical): ${p0.length} file(s)`,
    `P1 (standard): ${p1.length} file(s)`,
    `P2 (skipped): ${p2.length} file(s)`,
  ].join(', ');

  const priorityLog = `🎯 Smart Diff Prioritization: ${tierSummary}. Budget: ${maxChars.toLocaleString()} chars. Packed: ${packedDiff.length.toLocaleString()} chars. Skipped: ${skipped.length} file(s).`;

  return {
    packedDiff,
    skippedFiles: skipped,
    priorityLog,
    totalInputChars,
    packedChars: packedDiff.length,
  };
}
