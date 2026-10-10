/**
 * ReviewGround - AI Review Prompt Builder
 * Constructs provider-optimized prompts including custom repo guidelines,
 * OWASP Top 10 / CWE taxonomies, multi-language instructions, and registry grounding.
 */

import * as fs from 'fs';

export interface PromptConfig {
  reviewLevel?: 'critical' | 'standard' | 'comprehensive';
  reviewLanguage?: string;
  enableOwaspTagging?: boolean;
  provider?: string;
  model?: string;
  packageGroundTruthNote?: string;
  repoContext?: string;
  truncatedDiff: string;
}

const ANTI_NITPICK_RULE =
  '\n\nSTRICT ANTI-NITPICK FILTER: Do NOT comment on code formatting, whitespace, indentation, semicolons, quotes, or purely subjective variable naming. If a standard linter (ESLint, Prettier, Ruff) can enforce it, DO NOT mention it.';

const SEVERITY_BADGES_INSTRUCTION =
  '\nSEVERITY RATING FORMAT: Prefix each finding with one of these standardized severity badges:\n- 🚨 **[BLOCKER]**: High/critical security vulnerabilities, data loss, crashes, or severe regressions.\n- ⚠️ **[WARNING]**: Performance bottlenecks, resource leaks, edge-case bugs, or unhandled errors.\n- 💡 **[SUGGESTION]**: Architectural enhancements or missing test coverage stubs (comprehensive mode only).\nDo NOT report low-value style opinions or manufacture non-existent issues.';

const REVIEW_FOCUS_MAP: Record<string, string> = {
  critical:
    '1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.\n2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).\n\nFocus ONLY on critical and security issues. Do NOT comment on style, naming, or minor improvements.' +
    ANTI_NITPICK_RULE,
  standard:
    '1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.\n2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).\n3. Performance bottlenecks (unbounded loops, N+1 queries, unindexed searches, missing cleanup).\n4. Direct, actionable code fixes with concise diff blocks.' +
    ANTI_NITPICK_RULE,
  comprehensive:
    '1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.\n2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).\n3. Performance bottlenecks (unbounded loops, N+1 queries, unindexed searches, missing cleanup).\n4. Code architecture, readability, naming conventions, and documentation gaps.\n5. Test coverage gaps and missing edge-case test scenarios.\n6. Direct, actionable code fixes with concise diff blocks.',
};

const GUIDELINE_CANDIDATES = [
  '.reviewground.yml',
  '.reviewground.yaml',
  '.github/reviewground.yml',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.cursor/rules',
  '.github/copilot-instructions.md',
  'CONTRIBUTING.md',
];

/**
 * Discovers and loads custom guidelines from .reviewground.yml, AGENTS.md,
 * CLAUDE.md, .cursorrules, or CONTRIBUTING.md, capped at 4,000 characters.
 */
export function loadCustomGuidelines(maxChars = 4000): string {
  for (const filename of GUIDELINE_CANDIDATES) {
    if (fs.existsSync(filename)) {
      try {
        const raw = fs.readFileSync(filename, 'utf-8').trim();
        if (raw) {
          const content = raw.length > maxChars
            ? raw.slice(0, maxChars) + '\n... [guidelines truncated to token ceiling] ...'
            : raw;
          console.log(`📋 Loaded custom review guidelines from ${filename} (${content.length} chars)`);
          return `\nRepository Custom Rules & Guidelines (${filename}):\n${content}\n`;
        }
      } catch {
        // Continue if unreadable
      }
    }
  }
  return '';
}

/**
 * Builds the provider-tailored system prompt and diff instructions.
 */
export function buildReviewPrompt(config: PromptConfig): string {
  const reviewLevel = config.reviewLevel || 'standard';
  const focusInstructions = REVIEW_FOCUS_MAP[reviewLevel] ?? REVIEW_FOCUS_MAP.standard;
  const customGuidelines = loadCustomGuidelines();

  // OWASP Top 10 & CWE Taxonomy injection
  const owaspInstruction = config.enableOwaspTagging !== false
    ? `\nSecurity Taxonomy Requirement: When flagging any security issue, you MUST include the relevant OWASP Top 10 category and CWE ID. Use this format:\n- ❌ **CWE-89: SQL Injection** (OWASP A03:2021 — Injection)\n- ⚠️ **CWE-79: Cross-Site Scripting (XSS)** (OWASP A03:2021)\n- 🔒 **CWE-798: Hardcoded Credentials** (OWASP A07:2021 — Identification and Authentication Failures)\n- 🔑 **CWE-284: Improper Access Control** (OWASP A01:2021)\n- 🌐 **CWE-918: SSRF** (OWASP A10:2021 — Server-Side Request Forgery)\nAlways cite the exact CWE-ID and OWASP category when security issues are found.\n`
    : '';

  // Multi-language output instruction
  const lang = (config.reviewLanguage || 'en').toLowerCase().trim();
  const languageInstruction =
    lang !== 'en' && lang !== 'english'
      ? `\nIMPORTANT: Write your entire review response in the following language: ${lang}.\n`
      : '';

  const packageGroundTruthNote = config.packageGroundTruthNote || '';
  const repoContext = config.repoContext || '';
  const activeProviderName = (config.provider || '').toLowerCase();
  const modelName = (config.model || '').toLowerCase();
  const contextInstructions = `${packageGroundTruthNote}${customGuidelines}${repoContext}${SEVERITY_BADGES_INSTRUCTION}${owaspInstruction}${languageInstruction}`;

  if (activeProviderName === 'anthropic' || modelName.startsWith('claude')) {
    // Claude: Prefers XML-structured tags for diff and instructions
    return `<instructions>
You are a Principal Software Engineer &amp; DevSecOps Lead reviewing a Pull Request.
Analyze the following git diff for:
${focusInstructions}
${contextInstructions}
If the code looks solid and has no issues at this review level, respond with "✅ All changes look clean, performant, and secure!" and a brief 2-bullet summary.

If you propose specific line-level code replacements, provide your human-readable review first. Then, at the very end of your response, provide an optional JSON block tagged with \`\`\`inline_suggestions:
\`\`\`inline_suggestions
[{ "path": "path/to/file.ts", "line": 42, "suggestion": "  exact line replacement" }]
\`\`\`
</instructions>

<diff>
${config.truncatedDiff}
</diff>
`;
  }

  if (activeProviderName === 'gemini' || modelName.startsWith('gemini')) {
    // Gemini: Benefits from explicit schema and JSON-structured output hints
    return `You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.

Task: Analyze the git diff below and produce a structured code review.

Review focus:
${focusInstructions}
${contextInstructions}
Response format:
- Start with a brief executive summary (1-2 sentences).
- Use markdown sections (## Bugs, ## Security, ## Performance, etc.) as appropriate for this review level.
- If code looks clean, respond: "✅ All changes look clean, performant, and secure!" plus 2-bullet summary.
- If you have specific line replacements, append a JSON block at the end:

\`\`\`inline_suggestions
[{ "path": "path/to/file.ts", "line": 42, "suggestion": "  exact line replacement" }]
\`\`\`

Git Diff:
\`\`\`diff
${config.truncatedDiff}
\`\`\`
`;
  }

  if (
    activeProviderName === 'groq' ||
    modelName.startsWith('qwen') ||
    modelName.startsWith('llama')
  ) {
    // Groq/Qwen: Performs better with clear markdown-separated sections
    return `## Role
You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.

## Task
Analyze the following git diff.

## Review Focus
${focusInstructions}
${contextInstructions}
## Instructions
- If the code is clean, say: "✅ All changes look clean, performant, and secure!" followed by 2 bullet points.
- Otherwise, list findings grouped under ### headers (Bugs, Security, Performance, etc.).
- When flagging security issues, always include the OWASP category and CWE ID.
- For specific line fixes, append at the very end:

\`\`\`inline_suggestions
[{ "path": "path/to/file.ts", "line": 42, "suggestion": "  exact line replacement" }]
\`\`\`

## Git Diff
\`\`\`diff
${config.truncatedDiff}
\`\`\`
`;
  }

  // Default generic prompt (OpenAI, DeepSeek, OpenRouter, Custom)
  return `You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.
Analyze the following git diff for:
${focusInstructions}
${contextInstructions}
If the code looks solid and has no issues at this review level, respond with "✅ All changes look clean, performant, and secure!" and a brief 2-bullet summary.

If you propose specific line-level code replacements on files in the diff, provide your human-readable review first. Then, at the very end of your response, provide an optional JSON block tagged with \`\`\`inline_suggestions so GitHub can render interactive 1-click commit suggestion buttons:
\`\`\`inline_suggestions
[
  {
    "path": "path/to/file.ts",
    "line": 42,
    "suggestion": "  exact line replacement"
  }
]
\`\`\`

Git Diff:
\`\`\`diff
${config.truncatedDiff}
\`\`\`
`;
}
