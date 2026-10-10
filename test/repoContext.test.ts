import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractChangedFilesFromDiff, buildRepoContext } from '../src/utils/repoContext.js';

describe('Lightweight Repo Context Grounder', () => {
  it('extracts changed file paths cleanly from unified diff', () => {
    const diff = `
diff --git a/src/utils/helpers.ts b/src/utils/helpers.ts
--- a/src/utils/helpers.ts
+++ b/src/utils/helpers.ts
@@ -1,2 +1,2 @@
diff --git a/src/models/user.ts b/src/models/user.ts
--- a/src/models/user.ts
+++ b/src/models/user.ts
`;
    const files = extractChangedFilesFromDiff(diff);
    assert.deepStrictEqual(files, ['src/utils/helpers.ts', 'src/models/user.ts']);
  });

  it('returns empty array when diff has no file headers', () => {
    const files = extractChangedFilesFromDiff('');
    assert.deepStrictEqual(files, []);
  });

  it('builds context outline for existing local directories touched in diff', () => {
    const diff = `
diff --git a/src/utils/helpers.ts b/src/utils/helpers.ts
--- a/src/utils/helpers.ts
+++ b/src/utils/helpers.ts
`;
    const context = buildRepoContext(diff);
    assert.ok(context.includes('Existing Project Structure'));
    assert.ok(context.includes('src/utils/'));
    assert.ok(context.includes('secretSanitizer.ts') || context.includes('fetchWithRetry.ts'));
  });

  it('handles non-existent directory paths gracefully', () => {
    const diff = `
diff --git a/nonexistent/fake/file.ts b/nonexistent/fake/file.ts
`;
    const context = buildRepoContext(diff);
    assert.strictEqual(context, '');
  });
});
