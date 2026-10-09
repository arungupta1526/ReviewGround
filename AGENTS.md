
# ReviewGround - AI & Developer Operating Standard (AGENTS.md)

This document establishes the mandatory architectural rules, Git workflows, security standards, and operational guidelines for both AI coding agents and human engineers contributing to the **ReviewGround** project.

---

## 1. Mandatory Git Workflow & Branching Rules

1. **NEVER make direct commits to `main`**.
2. For every bug fix, feature addition, or code modification, create a dedicated feature or fix branch:
   - Features: `feature/<feature-name>` (e.g., `feature/deepseek-provider`, `feature/step-durations-badge`)
   - Fixes: `fix/<issue-name>` (e.g., `fix/comment-patch-404`, `fix/diff-truncation-boundary`)
   - **Branch Off Current Working Branch**: Always branch off directly from the current working branch to preserve ongoing context and progress.
3. **Mandatory Pre-Commit & Pre-Push Checklist**:
   - **Sync & Prune**: Always run `git fetch --prune --all` before pushing or opening a PR to keep remote tracking branches clean.
   - **Typecheck & Bundle Compilation**: Run `npm run typecheck` and `npm run build` locally. Verify that `dist/index.js` is generated without TypeScript or bundling errors.
   - **Unit Tests**: Run `npm test` locally to ensure 100% of invariant and provider test suites pass cleanly.
   - **Inspect Changes**: Always check `git status`, `git diff`, and `git log -n 3 --oneline` before staging/committing to prevent accidental secret leaks or unneeded files.
   - **Environment Integrity**: Ensure any new environment variables or action inputs are documented in both `action.yml` and `README.md`. Never hardcode API keys, tokens, or private credentials into source code.
4. **Strict No-Unsolicited-Push Rule**:
   - Even if terminal execution permissions allow automatic progression, **NEVER execute `git push` to remote (`origin`) without informing and obtaining explicit confirmation from the user in chat first**. Committing locally is encouraged, but pushing to remote must always be pre-approved.
5. **Always Commit with Detailed Information**:
   - Never make short, vague, or one-liner commit messages (e.g., avoid `fix: updates` or `feat: changes`).
   - Every commit message MUST include:
     - A conventional commit header (`feat(...)`, `fix(...)`, `refactor(...)`).
     - A bulleted description detailing *what* changed across files/modules.
     - The architectural rationale (*why*).
     - Verification confirmation (e.g., `npm run build` and unit test status).
6. **Mandatory Post-Change README Walkthrough**:
   - After completing ANY code modification, bug fix, or feature addition, the AI agent MUST perform a thorough review and walkthrough of `README.md`.
   - Ensure complete documentation parity: all new inputs, environment variables, model defaults, provider capabilities, or workflow examples must be accurately reflected in `README.md`, regardless of whether README changes were explicitly requested.

---

## 2. GitHub Actions & Marketplace Standards

1. **Strict GitHub Action Version Integrity Standard**:
   - **NEVER downgrade GitHub Action versions** (e.g., never change `@v7` to `@v4` or `@v4` to `@v2`).
   - **Mandatory Web Search Verification**: Before modifying, touching, or writing any GitHub Action step or version tag (`@v...`), the AI MUST verify the latest releases.
   - **Zero Hallucination / No Assumptions**: Never assume or downgrade versions based on outdated training data memory. Preserve repository-established version tags.
2. **Self-Contained Bundle Rule (`dist/index.js`)**:
   - GitHub Actions runtime must be self-contained. Always bundle TypeScript code into a single zero-dependency production bundle (`dist/index.js`) using `esbuild`.
   - Never require end-users to run `npm install` inside their workflows to execute this action.
3. **Root `action.yml` Standard**:
   - `action.yml` must reside strictly in the repository root for GitHub Marketplace discovery.
   - Keep inputs, outputs, and branding (`icon: 'shield'`, `color: 'purple'`) accurate and documented.
4. **Node 24 & TypeScript 7.0 Baseline**:
   - The project strictly targets **Node 24 LTS** and **TypeScript 7.0.2+**.
   - Never downgrade `using: 'node24'` in `action.yml` to `node20`.
   - Never downgrade `package.json` engines or typescript compiler to version 5.x.

---

## 3. Modular Architecture & Small Files Standard

1. **Single-Responsibility & Line Ceilings**:
   - Target under **~200–250 lines** per file.
   - *Provider Adapters* (`src/providers/`): Ceiling of up to 250 lines (encapsulates fetch requests, model fallbacks, and payload formatting).
   - *Diff Reviewer Engine* (`src/reviewer.ts`): Ceiling of up to 350 lines (handles diff truncation, live npm verification, inline suggestions parsing).
   - *Post-CI Summary & Sticky Comments* (`src/summary.ts`): Ceiling of up to 300 lines (calculates stage durations via GitHub API and updates sticky PR comments).
   - *Functions & Methods*: 20–50 lines maximum. Adhere to Single Responsibility Principle.
2. **Grace Buffer**:
   - If a cohesive file exceeds its category ceiling by up to ~50 lines without violating single responsibility, preserve as-is to avoid unnatural micro-fragmentation.
3. **Zero Bulky SDK Bloat**:
   - Prefer native `fetch` with `AbortSignal.timeout(...)` over massive vendor SDKs (`@google/genai`, `openai`, `@anthropic-ai/sdk`) to keep bundle sizes under 1MB.
4. **Zod Runtime Schema Integrity**:
   - Use Zod (`zod ^4.6.5`) schemas for all action inputs and AI output parsing.
   - Always validate inline suggestions with `z.coerce.number()` on line numbers to prevent runtime crashes when LLMs return string line numbers (e.g. `"42"`).

---

## 4. Multi-Provider BYOK (Bring Your Own Key) Engine

1. **Auto-Detection Priority Hierarchy**:
   - `GEMINI_API_KEY`: Uses Google Gemini (default `gemini-3.5-flash-lite` or `gemini-3.1-flash-lite`) with Google Search tool grounding (`tools: [{ googleSearch: {} }]`).
   - `OPENAI_API_KEY`: Uses OpenAI (default `gpt-4o-mini` or `gpt-4o`).
   - `ANTHROPIC_API_KEY`: Uses Anthropic Claude (default `claude-3-5-haiku` or `claude-3-5-sonnet`).
   - `GROQ_API_KEY`: Uses Groq LPU (default `qwen/qwen3.8-27b`, with fallbacks `openai/gpt-oss-120b`, `openai/gpt-oss-20b`).
   - `DEEPSEEK_API_KEY`: Uses DeepSeek (default `deepseek-chat` or `deepseek-reasoner`).
   - `OPENROUTER_API_KEY`: Uses OpenRouter (default `qwen/qwen-2.5-coder-32b-instruct` or any model).
   - `LLM_BASE_URL` + `LLM_API_KEY`: Any OpenAI-compatible local or cloud endpoint (Ollama, Together AI, Fireworks, vLLM).
2. **Graceful Fallbacks & Reroute Protection**:
   - When a primary provider fails (rate limit, quota exceeded), automatically fail over to secondary configured keys without failing the entire CI workflow.
   - If user explicitly chooses `provider: 'custom'` or `provider: 'openrouter'`, never hijack or reroute models to Groq.

---

## 5. Security & Privacy Non-Negotiables

1. **Zero Prompt Leak**:
   - Never log user API keys, PR diffs, or authorization headers to public CI build logs.
2. **Permission Scoping**:
   - The action strictly requests `contents: read`, `pull-requests: write`, and `actions: read`.
   - Never require broad repository admin or write permissions.
3. **Anti-Hallucination Grounding**:
   - Proactively cross-examine package changes against `registry.npmjs.org` before prompting LLMs to eliminate false-positive version warnings.
4. **Bot & Dependabot Safety**:
   - Always detect and gracefully skip AI review for automated bot PRs (e.g. `dependabot[bot]`) without failing the CI run, as GitHub strictly restricts repository secrets for automated bots.
5. **License Compliance**:
   - ReviewGround is licensed under **AGPLv3**. Respect open-source copyleft terms while keeping the action accessible for all developers worldwide.
