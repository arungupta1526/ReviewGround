import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeSequenceDiagram,
  sanitizeMermaidInMarkdown,
  ensureBalancedCodeFences,
} from '../src/utils/mermaidSanitizer.js';

describe('Mermaid Diagram Sanitizer & Glitch Auto-Healer', () => {
  it('heals hallucinated words inside dotted return arrows (--yminus->>)', () => {
    const raw = `sequenceDiagram
    Customer->>CheckoutPortal: Retry payment
    CheckoutPortal->>PaymentAPI: POST /restart
    PaymentAPI->>DB: Query sessions
    DB--yminus->>PaymentAPI: Returns session records
    PaymentAPI-->>CheckoutPortal: HTTP 200 OK`;

    const healed = sanitizeSequenceDiagram(raw);
    assert.ok(healed.includes('DB-->>PaymentAPI: Returns session records'));
    assert.ok(!healed.includes('yminus'));
    assert.ok(healed.includes('CheckoutPortal->>PaymentAPI: POST /restart'));
  });

  it('heals arbitrary hallucinated words in arrows (--return->>, -call->>, --response-->)', () => {
    const input = [
      'A--return->>B: data',
      'B-call->>C: invoke',
      'C--response-->B: ack',
      'D-open-->E: stream',
    ].join('\n');

    const result = sanitizeSequenceDiagram(input);
    assert.strictEqual(
      result,
      [
        'A-->>B: data',
        'B->>C: invoke',
        'C-->B: ack',
        'D-->E: stream',
      ].join('\n')
    );
  });

  it('heals broken spacing in arrows (-- >>, - >>, -> >)', () => {
    const input = [
      'A-- >>B: spaced dotted',
      'C- >>D: spaced solid',
      'E-> >F: spaced head',
    ].join('\n');

    const result = sanitizeSequenceDiagram(input);
    assert.strictEqual(
      result,
      [
        'A-->>B: spaced dotted',
        'C->>D: spaced solid',
        'E->>F: spaced head',
      ].join('\n')
    );
  });

  it('preserves valid standard Mermaid sequence diagram syntax without changes', () => {
    const valid = `sequenceDiagram
    autonumber
    actor User
    User->>API: GET /items
    API->>DB: SELECT *
    DB-->>API: rows
    API-->>User: 200 OK (JSON)`;

    const result = sanitizeSequenceDiagram(valid);
    assert.strictEqual(result, valid);
  });

  it('sanitizes mermaid code blocks embedded inside full markdown review text', () => {
    const markdown = `## Architecture & Workflow

\`\`\`mermaid
sequenceDiagram
    Client->>Gateway: Request
    Gateway->>Service: Forward
    Service--yminus->>Gateway: Reply
    Gateway-->>Client: 200
\`\`\`

Some other text.`;

    const healed = sanitizeMermaidInMarkdown(markdown);
    assert.ok(!healed.includes('yminus'));
    assert.ok(healed.includes('Service-->>Gateway: Reply'));
    assert.ok(healed.includes('Some other text.'));
  });

  it('handles markdown without mermaid blocks safely', () => {
    const plain = '# Review\nEverything is clean.';
    assert.strictEqual(sanitizeMermaidInMarkdown(plain), plain);
    assert.strictEqual(sanitizeMermaidInMarkdown(''), '');
  });

  it('heals unclosed mermaid block when aborted without arrows (YouPI-PG PR #16 regression test)', () => {
    const raw = `This PR implements a critical architectural shift by enforcing the Verification Pipeline.

### Architectural Sequence
The following diagram illustrates the unified verification flow for both Poller and Android SMS ingest points:

\`\`\`mermaid
sequenceDiagram
    participant O as Observer`;

    const healed = sanitizeMermaidInMarkdown(raw);
    // Unclosed block with no interactions should be stripped along with the dangling header
    assert.strictEqual(healed.includes('```mermaid'), false);
    assert.strictEqual(healed.includes('Architectural Sequence'), false);
    assert.ok(healed.includes('This PR implements a critical architectural shift'));
  });

  it('heals unclosed mermaid block when truncated with valid interactions and closes fence', () => {
    const raw = `### Architectural Sequence

\`\`\`mermaid
sequenceDiagram
    Client->>API: POST /verify
    API->>DB: Query session
    DB--yminus->>API: Return state
    API-->>Client: 200 OK
    API->>`;

    const healed = sanitizeMermaidInMarkdown(raw);
    assert.ok(healed.includes('```mermaid'));
    assert.ok(healed.includes('DB-->>API: Return state'));
    assert.ok(healed.includes('API-->>Client: 200 OK'));
    assert.strictEqual(healed.includes('yminus'), false);
    // Dangling trailing incomplete line "API->>" should be pruned
    assert.strictEqual(healed.includes('API->>\n```'), false);
    // Should be properly closed
    assert.ok(healed.endsWith('```'));
  });

  it('ensures unclosed code fences are properly closed with ensureBalancedCodeFences', () => {
    const oddFences = 'Some text\n```typescript\nconst x = 1;';
    const balanced = ensureBalancedCodeFences(oddFences);
    assert.ok(balanced.endsWith('```\n'));
    assert.strictEqual((balanced.match(/```/g) || []).length % 2, 0);

    const alreadyBalanced = '```json\n{"a": 1}\n```';
    assert.strictEqual(ensureBalancedCodeFences(alreadyBalanced), alreadyBalanced);
  });
});
