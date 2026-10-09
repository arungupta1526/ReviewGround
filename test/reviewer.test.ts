import { describe, it } from 'node:test';
import assert from 'node:assert';
import { verifyPackagesInDiff, InlineSuggestionsListSchema } from '../src/reviewer.js';

describe('Reviewer Engine', () => {
  it('parses added dependencies from package.json diff and checks registry', async () => {
    const diff = `
diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -10,3 +10,5 @@
+    "typescript": "^7.0.2",
+    "esbuild": "^0.25.0"
`;

    const verified = await verifyPackagesInDiff(diff);
    assert.ok(Array.isArray(verified));
    // typescript and esbuild are real packages on npm registry
    assert.ok(verified.some((v) => v.includes('typescript')));
    assert.ok(verified.some((v) => v.includes('esbuild')));
  });

  it('ignores non-package lines in diff', async () => {
    const diff = `
+    "name": "my-project",
+    "version": "1.0.0",
+    "scripts": {
+      "test": "echo test"
+    }
`;
    const verified = await verifyPackagesInDiff(diff);
    assert.strictEqual(verified.length, 0);
  });

  it('validates inline suggestions and coerces string line numbers using Zod', () => {
    const rawSuggestions = [
      {
        path: 'src/auth/jwt.ts',
        line: '42', // string from LLM
        suggestion: '  const payload = jwt.verify(token, secretKey);',
      },
      {
        path: 'src/utils.ts',
        line: 15,
        suggestion: '  return safeValue;',
      },
    ];

    const result = InlineSuggestionsListSchema.safeParse(rawSuggestions);
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 2);
      assert.strictEqual(result.data[0].line, 42); // Coerced to number!
      assert.strictEqual(typeof result.data[0].line, 'number');
      assert.strictEqual(result.data[1].line, 15);
    }

    const invalid = [{ path: '', line: -1, suggestion: '' }];
    const invalidResult = InlineSuggestionsListSchema.safeParse(invalid);
    assert.strictEqual(invalidResult.success, false);
  });
});
