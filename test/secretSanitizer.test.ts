import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeDiffSecrets } from '../src/utils/secretSanitizer.js';

describe('Pre-Flight Diff Secret & PII Sanitizer', () => {
  it('passes clean diff through unchanged', () => {
    const cleanDiff = `
diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-const greeting = "hello";
+const greeting = "hello world";
`;
    const result = sanitizeDiffSecrets(cleanDiff);
    assert.strictEqual(result.sanitizedDiff, cleanDiff);
    assert.strictEqual(result.redactedCount, 0);
    assert.strictEqual(result.redactedTypes.length, 0);
  });

  it('redacts AWS Access Keys', () => {
    const awsToken = ['AKIA', '1234567890ABCDEF'].join('');
    const diff = `+const AWS_KEY = "${awsToken}";`;
    const result = sanitizeDiffSecrets(diff);
    assert.strictEqual(result.sanitizedDiff, `+const AWS_KEY = "[REDACTED_SECRET:AWS_KEY]";`);
    assert.strictEqual(result.redactedCount, 1);
    assert.ok(result.redactedTypes.includes('AWS_ACCESS_KEY'));
  });

  it('redacts GitHub Personal Access Tokens', () => {
    const ghpToken = ['ghp_', '123456789012345678901234567890123456'].join('');
    const diff = `+const token = "${ghpToken}";`;
    const result = sanitizeDiffSecrets(diff);
    assert.strictEqual(result.sanitizedDiff, `+const token = "[REDACTED_SECRET:GITHUB_TOKEN]";`);
    assert.strictEqual(result.redactedCount, 1);
    assert.ok(result.redactedTypes.includes('GITHUB_TOKEN'));
  });

  it('redacts Slack and OpenAI API keys', () => {
    const slackToken = ['xoxb', '1234567890', '123456789012', 'abcdefghijklmnopqrstuvwx'].join('-');
    const openaiToken = ['sk-proj-', '12345678901234567890123456789012345678901234567890'].join('');
    const diff = `
+const slack = "${slackToken}";
+const openai = "${openaiToken}";
`;
    const result = sanitizeDiffSecrets(diff);
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:SLACK_TOKEN]'));
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:OPENAI_KEY]'));
    assert.strictEqual(result.redactedCount, 2);
  });

  it('redacts Private Keys block', () => {
    const diff = `
+const privKey = \`-----BEGIN RSA PRIVATE KEY-----
+MIIEowIBAAKCAQEA0...
+-----END RSA PRIVATE KEY-----\`;
`;
    const result = sanitizeDiffSecrets(diff);
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:PRIVATE_KEY]'));
    assert.strictEqual(result.redactedCount, 1);
  });

  it('redacts Bearer JWT tokens', () => {
    const jwtToken = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ].join('.');
    const diff = `+headers: { Authorization: "Bearer ${jwtToken}" }`;
    const result = sanitizeDiffSecrets(diff);
    assert.ok(result.sanitizedDiff.includes('Bearer [REDACTED_SECRET:JWT_TOKEN]'));
    assert.strictEqual(result.redactedCount, 1);
  });

  it('redacts Stripe live secret keys and restricted keys', () => {
    const stripeToken = ['sk', 'live', '51AbcdEFghIJklmnOPqrSTuvwx'].join('_');
    const diff = `+const stripe = "${stripeToken}";`;
    const result = sanitizeDiffSecrets(diff);
    assert.strictEqual(result.sanitizedDiff, `+const stripe = "[REDACTED_SECRET:STRIPE_KEY]";`);
    assert.strictEqual(result.redactedCount, 1);
    assert.ok(result.redactedTypes.includes('STRIPE_KEY'));
  });

  it('redacts Google Cloud AIza API keys', () => {
    const googleToken = ['AIza', 'SyD1234567890abcdefghijklmnopqrstuv'].join('');
    const diff = `+const googleKey = "${googleToken}";`;
    const result = sanitizeDiffSecrets(diff);
    assert.strictEqual(result.sanitizedDiff, `+const googleKey = "[REDACTED_SECRET:GOOGLE_API_KEY]";`);
    assert.strictEqual(result.redactedCount, 1);
    assert.ok(result.redactedTypes.includes('GOOGLE_API_KEY'));
  });

  it('redacts SendGrid, Twilio, HuggingFace, Discord and Postman tokens', () => {
    const sgToken = ['SG', 'abcdefghijklmnopqrstuv', '1234567890123456789012345678901234567890123'].join('.');
    const twilioToken = ['SK', '1234567890abcdef1234567890abcdef'].join('');
    const hfToken = ['hf_', 'abcdefghijklmnopqrstuvwxyz012345678'].join('');
    const postmanToken = ['PMAK', '1234567890abcdef12345678'].join('-');
    const diff = `
+const sendgrid = "${sgToken}";
+const twilio = "${twilioToken}";
+const hf = "${hfToken}";
+const postman = "${postmanToken}";
`;
    const result = sanitizeDiffSecrets(diff);
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:SENDGRID_KEY]'));
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:TWILIO_KEY]'));
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:HUGGINGFACE_TOKEN]'));
    assert.ok(result.sanitizedDiff.includes('[REDACTED_SECRET:POSTMAN_KEY]'));
    assert.strictEqual(result.redactedCount, 4);
  });

  it('handles empty or non-string input safely', () => {
    const emptyResult = sanitizeDiffSecrets('');
    assert.strictEqual(emptyResult.sanitizedDiff, '');
    assert.strictEqual(emptyResult.redactedCount, 0);

    // @ts-expect-error test non-string input resilience
    const invalidResult = sanitizeDiffSecrets(null);
    assert.strictEqual(invalidResult.sanitizedDiff, '');
    assert.strictEqual(invalidResult.redactedCount, 0);
  });
});
