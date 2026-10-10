/**
 * ReviewGround - Multi-Ecosystem Package Registry Verifier
 * Feature 3: Pluggable registry verifier for NPM, PyPI, Crates.io, and Go module proxy.
 * Eliminates LLM hallucinations about package versions across JavaScript, Python, Rust, and Go repos.
 */

export interface VerifiedPackage {
  name: string;
  requestedVersion: string;
  resolvedVersion?: string;
  registry: 'npm' | 'pypi' | 'crates' | 'go';
  verified: boolean;
  note: string;
}

// ──────────────────────────────────────────────
// NPM Registry (registry.npmjs.org)
// ──────────────────────────────────────────────

/**
 * Extracts added npm package entries from a git diff of package.json.
 */
function extractNpmDeps(diffText: string): Array<{ name: string; version: string }> {
  const deps: Array<{ name: string; version: string }> = [];
  const ignore = ['name', 'version', 'description', 'scripts', 'bin', 'main', 'types', 'engines', 'node', 'npm'];

  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+')) continue;
    const match = line.match(/^\+\s*"(@?[a-z0-9_./-]+)"\s*:\s*"[\^~>=<]*([0-9]+(?:\.[0-9]+)*[^"]*)"/);
    if (match && !ignore.includes(match[1])) {
      deps.push({ name: match[1], version: match[2] });
    }
  }
  return deps;
}

async function verifyNpmPackage(name: string, version: string): Promise<VerifiedPackage> {
  const base: VerifiedPackage = { name, requestedVersion: version, registry: 'npm', verified: false, note: '' };
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      base.verified = true;
      base.note = `${name}@${version} is confirmed published on npm`;
      return base;
    }
    const latestRes = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
      signal: AbortSignal.timeout(4000),
    });
    if (latestRes.ok) {
      const info = (await latestRes.json()) as { version?: string };
      base.resolvedVersion = info.version;
      base.verified = true;
      base.note = `${name} (latest on npm registry: ${info.version})`;
    }
  } catch {
    // Network timeout — skip silently
  }
  return base;
}

// ──────────────────────────────────────────────
// PyPI Registry (pypi.org)
// ──────────────────────────────────────────────

/**
 * Extracts added Python package lines from requirements.txt or pyproject.toml diffs.
 */
function extractPypiDeps(diffText: string): Array<{ name: string; version: string }> {
  const deps: Array<{ name: string; version: string }> = [];
  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+')) continue;
    const stripped = line.slice(1).trim();
    // requirements.txt pattern: package==1.2.3 or package>=1.0.0
    const reqMatch = stripped.match(/^([A-Za-z0-9_\-]+)\s*[=><~!^]+\s*([0-9][^\s,;#]*)/);
    if (reqMatch) {
      deps.push({ name: reqMatch[1].toLowerCase().replace(/_/g, '-'), version: reqMatch[2] });
      continue;
    }
    // pyproject.toml pattern: "package>=1.0.0"
    const pyprojectMatch = stripped.match(/["']?([A-Za-z0-9_\-]+)["']?\s*[=><~!^]+\s*["']?([0-9][^"',\s]*)/);
    if (pyprojectMatch) {
      deps.push({ name: pyprojectMatch[1].toLowerCase().replace(/_/g, '-'), version: pyprojectMatch[2] });
    }
  }
  return deps;
}

async function verifyPypiPackage(name: string, version: string): Promise<VerifiedPackage> {
  const base: VerifiedPackage = { name, requestedVersion: version, registry: 'pypi', verified: false, note: '' };
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'ReviewGround-CI-Reviewer/1.3.0' },
    });
    if (res.ok) {
      base.verified = true;
      base.note = `${name}==${version} is confirmed published on PyPI`;
      return base;
    }
    const latestRes = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'ReviewGround-CI-Reviewer/1.3.0' },
    });
    if (latestRes.ok) {
      const info = (await latestRes.json()) as { info?: { version?: string } };
      base.resolvedVersion = info.info?.version;
      base.verified = true;
      base.note = `${name} (latest on PyPI: ${info.info?.version})`;
    }
  } catch {
    // Network timeout — skip silently
  }
  return base;
}

// ──────────────────────────────────────────────
// Crates.io (Rust)
// ──────────────────────────────────────────────

function extractCratesDeps(diffText: string): Array<{ name: string; version: string }> {
  const deps: Array<{ name: string; version: string }> = [];
  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+')) continue;
    const simpleMatch = line.match(/^\+\s*([a-z0-9_\-]+)\s*=\s*"([0-9][^"]*)"/);
    if (simpleMatch) {
      deps.push({ name: simpleMatch[1], version: simpleMatch[2] });
      continue;
    }
    const tableMatch = line.match(/^\+\s*([a-z0-9_\-]+)\s*=\s*\{[^}]*version\s*=\s*"([0-9][^"]*)"/);
    if (tableMatch) {
      deps.push({ name: tableMatch[1], version: tableMatch[2] });
    }
  }
  return deps;
}

async function verifyCratesPackage(name: string, version: string): Promise<VerifiedPackage> {
  const base: VerifiedPackage = { name, requestedVersion: version, registry: 'crates', verified: false, note: '' };
  try {
    const res = await fetch(
      `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
      { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'ReviewGround-CI-Reviewer/1.3.0' } }
    );
    if (res.ok) {
      base.verified = true;
      base.note = `${name} v${version} is confirmed published on crates.io`;
      return base;
    }
    const latestRes = await fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'ReviewGround-CI-Reviewer/1.3.0' },
    });
    if (latestRes.ok) {
      const info = (await latestRes.json()) as { crate?: { newest_version?: string } };
      base.resolvedVersion = info.crate?.newest_version;
      base.verified = true;
      base.note = `${name} (latest on crates.io: ${info.crate?.newest_version})`;
    }
  } catch {
    // Network timeout — skip silently
  }
  return base;
}

// ──────────────────────────────────────────────
// Go Module Proxy (proxy.golang.org)
// ──────────────────────────────────────────────

function extractGoDeps(diffText: string): Array<{ name: string; version: string }> {
  const deps: Array<{ name: string; version: string }> = [];
  for (const line of diffText.split('\n')) {
    if (!line.startsWith('+')) continue;
    const match = line.match(/^\+\s*(?:require\s+)?([a-zA-Z0-9.\-_/]+)\s+(v[0-9][^\s]*)/);
    if (match) {
      deps.push({ name: match[1], version: match[2] });
    }
  }
  return deps;
}

async function verifyGoModule(name: string, version: string): Promise<VerifiedPackage> {
  const base: VerifiedPackage = { name, requestedVersion: version, registry: 'go', verified: false, note: '' };
  try {
    // Go proxy requires lowercase module paths with case-encoded capital letters
    const encodedName = name.replace(/[A-Z]/g, (c) => `!${c.toLowerCase()}`);
    const encodedVersion = version.replace(/[A-Z]/g, (c) => `!${c.toLowerCase()}`);
    const res = await fetch(
      `https://proxy.golang.org/${encodedName}/@v/${encodedVersion}.info`,
      { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'ReviewGround-CI-Reviewer/1.3.0' } }
    );
    if (res.ok) {
      base.verified = true;
      base.note = `${name} ${version} is confirmed on Go module proxy`;
      return base;
    }
    const listRes = await fetch(`https://proxy.golang.org/${encodedName}/@latest`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'ReviewGround-CI-Reviewer/1.3.0' },
    });
    if (listRes.ok) {
      const info = (await listRes.json()) as { Version?: string };
      base.resolvedVersion = info.Version;
      base.verified = true;
      base.note = `${name} (latest on Go proxy: ${info.Version})`;
    }
  } catch {
    // Network timeout — skip silently
  }
  return base;
}

// ──────────────────────────────────────────────
// Ecosystem Auto-Detector
// ──────────────────────────────────────────────

type Ecosystem = 'npm' | 'pypi' | 'crates' | 'go';

function detectEcosystem(diffText: string): Ecosystem | 'mixed' {
  const files = [...diffText.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
  const hasNpm = files.some((f) => f === 'package.json' || f.endsWith('/package.json'));
  const hasPypi = files.some((f) =>
    f.endsWith('requirements.txt') || f === 'pyproject.toml' || f.endsWith('/pyproject.toml')
  );
  const hasCargo = files.some((f) => f === 'Cargo.toml' || f.endsWith('/Cargo.toml'));
  const hasGo = files.some((f) => f === 'go.mod' || f.endsWith('/go.mod'));

  const count = [hasNpm, hasPypi, hasCargo, hasGo].filter(Boolean).length;
  if (count > 1) return 'mixed';
  if (hasNpm) return 'npm';
  if (hasPypi) return 'pypi';
  if (hasCargo) return 'crates';
  if (hasGo) return 'go';
  return 'npm'; // default fallback
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export interface RegistryGroundingResult {
  notes: string[];
  ecosystems: string[];
  totalVerified: number;
}

/**
 * Verifies all package changes in a diff against the appropriate live registry.
 * Supports NPM, PyPI, Crates.io, and Go module proxy.
 * Returns grounding notes suitable for injection into LLM prompts.
 */
export async function verifyPackagesMultiRegistry(diffText: string): Promise<RegistryGroundingResult> {
  const ecosystem = detectEcosystem(diffText);
  const allVerified: VerifiedPackage[] = [];
  const ecosystemsChecked: string[] = [];

  const extractors: Record<Ecosystem, (d: string) => Array<{ name: string; version: string }>> = {
    npm: extractNpmDeps,
    pypi: extractPypiDeps,
    crates: extractCratesDeps,
    go: extractGoDeps,
  };

  const verifiers: Record<Ecosystem, (n: string, v: string) => Promise<VerifiedPackage>> = {
    npm: verifyNpmPackage,
    pypi: verifyPypiPackage,
    crates: verifyCratesPackage,
    go: verifyGoModule,
  };

  const checkEco = async (eco: Ecosystem) => {
    const deps = extractors[eco](diffText);
    if (deps.length === 0) return;
    ecosystemsChecked.push(eco);
    const results = await Promise.all(deps.map((d) => verifiers[eco](d.name, d.version)));
    allVerified.push(...results.filter((r) => r.verified));
  };

  const ecos: Ecosystem[] = ecosystem === 'mixed' ? ['npm', 'pypi', 'crates', 'go'] : [ecosystem];
  await Promise.all(ecos.map(checkEco));

  return {
    notes: allVerified.map((p) => p.note),
    ecosystems: ecosystemsChecked,
    totalVerified: allVerified.length,
  };
}
