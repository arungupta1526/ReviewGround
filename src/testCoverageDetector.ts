/**
 * ReviewGround - Missing Unit Test Detector
 * Feature 7: Detects new exported functions/classes/endpoints added in a PR
 * without corresponding test coverage updates.
 * Generates suggested Vitest/Jest/pytest/Go test stubs.
 */

export interface NewSymbol {
  filePath: string;
  symbolName: string;
  symbolType: 'function' | 'class' | 'method' | 'endpoint';
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'ruby' | 'unknown';
}

export interface TestCoverageReport {
  newSymbols: NewSymbol[];
  testFilesChanged: string[];
  hasTestCoverage: boolean;
  warnings: string[];
  suggestedTests: string;
}

// ──────────────────────────────────────────────
// Language & Test File Detectors
// ──────────────────────────────────────────────

const TEST_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /_test\.go$/,
  /test_.*\.py$/,
  /_spec\.rb$/,
  /\.test\.py$/,
  /\/test\/.*\.(ts|js|py|go|rb)$/,
  /\/tests\/.*\.(ts|js|py|go|rb)$/,
  /\/__tests__\//,
];

function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filePath));
}

function detectLanguage(filePath: string): NewSymbol['language'] {
  if (/\.(ts|tsx)$/.test(filePath)) return 'typescript';
  if (/\.(js|jsx)$/.test(filePath)) return 'javascript';
  if (/\.py$/.test(filePath)) return 'python';
  if (/\.go$/.test(filePath)) return 'go';
  if (/\.rb$/.test(filePath)) return 'ruby';
  return 'unknown';
}

// ──────────────────────────────────────────────
// Symbol Extraction from Diff
// ──────────────────────────────────────────────

/**
 * Extracts new exported functions, classes, and HTTP endpoints added in diff.
 */
function extractNewSymbols(diffBlock: string, filePath: string, lang: NewSymbol['language']): NewSymbol[] {
  const symbols: NewSymbol[] = [];

  for (const line of diffBlock.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const code = line.slice(1);

    if (lang === 'typescript' || lang === 'javascript') {
      // export function foo(...), export async function foo(...)
      const fnMatch = code.match(/^\s*export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (fnMatch) {
        symbols.push({ filePath, symbolName: fnMatch[1], symbolType: 'function', language: lang });
        continue;
      }
      // export class Foo
      const classMatch = code.match(/^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (classMatch) {
        symbols.push({ filePath, symbolName: classMatch[1], symbolType: 'class', language: lang });
        continue;
      }
      // export const foo = (...) => or export const foo = function
      const arrowMatch = code.match(/^\s*export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s+)?\(/);
      if (arrowMatch) {
        symbols.push({ filePath, symbolName: arrowMatch[1], symbolType: 'function', language: lang });
        continue;
      }
      // Express/Fastify/Hono route patterns: app.get/post/put/delete/patch(...)
      const routeMatch = code.match(/^\s*(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/);
      if (routeMatch) {
        symbols.push({ filePath, symbolName: `${routeMatch[1].toUpperCase()} ${routeMatch[2]}`, symbolType: 'endpoint', language: lang });
      }
    } else if (lang === 'python') {
      // def foo(...): — only top-level or class methods that are public
      const fnMatch = code.match(/^\s*def\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/);
      if (fnMatch && !fnMatch[1].startsWith('_')) {
        symbols.push({ filePath, symbolName: fnMatch[1], symbolType: 'function', language: lang });
        continue;
      }
      // class Foo:
      const classMatch = code.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (classMatch) {
        symbols.push({ filePath, symbolName: classMatch[1], symbolType: 'class', language: lang });
      }
    } else if (lang === 'go') {
      // func FooBar(...) — exported (capitalized)
      const fnMatch = code.match(/^\s*func\s+(?:\([^)]*\)\s+)?([A-Z][A-Za-z0-9_]*)\s*\(/);
      if (fnMatch) {
        symbols.push({ filePath, symbolName: fnMatch[1], symbolType: 'function', language: lang });
      }
    }
  }

  return symbols;
}

// ──────────────────────────────────────────────
// Test Stub Generator
// ──────────────────────────────────────────────

function generateTestStub(symbol: NewSymbol): string {
  switch (symbol.language) {
    case 'typescript':
    case 'javascript': {
      if (symbol.symbolType === 'class') {
        return `describe('${symbol.symbolName}', () => {
  it('should instantiate correctly', () => {
    const instance = new ${symbol.symbolName}();
    expect(instance).toBeDefined();
  });
});`;
      }
      if (symbol.symbolType === 'endpoint') {
        const [method, path] = symbol.symbolName.split(' ');
        return `it('${method} ${path} — should respond with 200', async () => {
  const res = await request(app).${method?.toLowerCase() ?? 'get'}('${path}');
  expect(res.status).toBe(200);
});`;
      }
      return `it('${symbol.symbolName} — should work correctly', () => {
  // Arrange
  // Act
  const result = ${symbol.symbolName}();
  // Assert
  expect(result).toBeDefined();
});`;
    }

    case 'python': {
      if (symbol.symbolType === 'class') {
        return `def test_${symbol.symbolName.toLowerCase()}_instantiation():
    instance = ${symbol.symbolName}()
    assert instance is not None`;
      }
      return `def test_${symbol.symbolName}():
    # Arrange + Act
    result = ${symbol.symbolName}()
    # Assert
    assert result is not None`;
    }

    case 'go': {
      return `func Test${symbol.symbolName}(t *testing.T) {
    // Arrange
    // Act
    // Assert
    t.Log("Test for ${symbol.symbolName}")
}`;
    }

    default:
      return `// TODO: Add test for ${symbol.symbolName}`;
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Analyzes a git diff to detect new exported symbols without test coverage.
 * Returns warnings and suggested test stubs for uncovered code.
 */
export function analyzeTestCoverage(rawDiff: string): TestCoverageReport {
  const hunkBlocks = rawDiff.split(/(?=^diff --git)/m).filter((b) => b.trim().length > 0);

  const testFilesChanged: string[] = [];
  const allNewSymbols: NewSymbol[] = [];

  for (const block of hunkBlocks) {
    const headerMatch = block.match(/^diff --git a\/(.+?) b\//m);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];

    if (isTestFile(filePath)) {
      testFilesChanged.push(filePath);
      continue;
    }

    const lang = detectLanguage(filePath);
    if (lang === 'unknown' || lang === 'ruby') continue; // Limited support

    const symbols = extractNewSymbols(block, filePath, lang);
    allNewSymbols.push(...symbols);
  }

  // Only warn about functions/endpoints — classes are often just data structures
  const uncoveredSymbols = allNewSymbols.filter(
    (s) => s.symbolType === 'function' || s.symbolType === 'endpoint'
  );

  const hasTestCoverage = testFilesChanged.length > 0 || uncoveredSymbols.length === 0;
  const warnings: string[] = [];

  if (uncoveredSymbols.length > 0 && testFilesChanged.length === 0) {
    const names = uncoveredSymbols.map((s) => `\`${s.symbolName}\``).join(', ');
    warnings.push(
      `⚠️ **${uncoveredSymbols.length} new exported function(s)/endpoint(s) detected without corresponding unit tests:** ${names}`
    );
  } else if (uncoveredSymbols.length > 0 && testFilesChanged.length > 0) {
    // Tests were added but may not cover all new symbols — soft warning
    warnings.push(
      `ℹ️ **${uncoveredSymbols.length} new exported symbol(s) added.** Test files were updated — ensure coverage includes all new functionality.`
    );
  }

  // Generate test stubs for the first 3 uncovered symbols (avoid overwhelming review)
  const stubSymbols = uncoveredSymbols.slice(0, 3);
  let suggestedTests = '';
  if (stubSymbols.length > 0 && testFilesChanged.length === 0) {
    const stubs = stubSymbols.map((s) => `// ${s.filePath} → ${s.symbolName}\n${generateTestStub(s)}`).join('\n\n');
    suggestedTests = `<details>\n<summary>🧪 Click to view suggested unit test stubs</summary>\n\n\`\`\`${stubSymbols[0]?.language ?? 'typescript'}\n${stubs}\n\`\`\`\n</details>`;
  }

  return {
    newSymbols: allNewSymbols,
    testFilesChanged,
    hasTestCoverage,
    warnings,
    suggestedTests,
  };
}
