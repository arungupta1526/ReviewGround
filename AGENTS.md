
# ReviewGround - AI & Developer Operating Standard (AGENTS.md)

This document establishes the mandatory architectural rules, Git workflows, security standards, and operational guidelines for both AI coding agents and human engineers contributing to the **ReviewGround** project.

---

## 1. Mandatory Git Workflow & Branching Rules

1. **NEVER make direct commits to `main`**.
2. **Branch Directly Off Active Working Branch (Never Checkout `main` First)**:
   - For every bug fix, feature addition, or code modification, create a dedicated feature or fix branch:
     - Features: `feature/<feature-name>` (e.g., `feature/deepseek-provider`, `feature/step-durations-badge`)
     - Fixes: `fix/<issue-name>` (e.g., `fix/comment-patch-404`, `fix/diff-truncation-boundary`)
   - **Never revert to or checkout `main` when creating a new branch**: Always branch directly off the **current active working branch** (`git checkout -b <new-branch>`). This preserves ongoing work, staged changes, and prevents context loss or accidental regression.
3. **Mandatory Pre-Commit & Pre-Push Checklist**:
   - **Sync & Prune (`git fetch --prune --all`)**: Always run `git fetch --prune --all` (Git's prune/purge command) before creating branches, pushing, or opening a PR to clean up stale remote-tracking references and stay in sync with origin.
   - **Typecheck & Bundle Compilation**: Run `npm run typecheck` and `npm run build` locally. Verify that `dist/index.js` is generated without TypeScript or bundling errors.
   - **Unit Tests**: Run `npm test` locally to ensure 100% of invariant and provider test suites pass cleanly.
   - **Inspect Changes**: Always check `git status`, `git diff`, and `git log -n 3 --oneline` before staging/committing to prevent accidental secret leaks or unneeded files.
   - **Environment Integrity**: Ensure any new environment variables or action inputs are documented in both `action.yml` and `README.md`. Never hardcode API keys, tokens, or private credentials into source code.
   - **Architecture Diagram Assets**: Whenever the architecture workflow is touched, ensure both `images/architecture-diagram.svg` and high-res `images/architecture-diagram.png` are regenerated using the mandatory Mermaid CLI command and verified against `npm test`.
4. **Strict No-Unsolicited-Push Rule & PR Creation Protocol**:
   - **Never Push Automatically**: After committing locally, **NEVER execute `git push` to remote (`origin`) without informing and obtaining explicit confirmation from the user in chat first**. All commits must remain strictly local until pre-approved.
   - **Auto-Create PR Upon Push Confirmation**: Once the user explicitly approves pushing, push the branch (`git push -u origin <branch>`). Always check first if a PR already exists for this branch (`gh pr list --head <branch>`); if an existing PR is found, inform the developer of the updated PR. If no PR exists, immediately open a Pull Request against `main` using GitHub CLI (`gh pr create`) with a detailed title, summary, and verification details.
   - **Strict No-Unsolicited-Merge Rule & Clean Branch Deletion (`--delete-branch`)**:
     - **NEVER merge the PR into `main` automatically**. Always ask/inform the developer and wait for their explicit command before merging any PR.
     - **Mandatory Branch Deletion & Standard Merge Commit (`--merge`)**: When the user explicitly instructs to merge, ALWAYS execute the merge using a standard merge commit with automatic branch deletion enabled (`gh pr merge <pr-number> --merge --delete-branch`), followed by cleaning up local tracking references (`git checkout main && git pull && git fetch --prune --all && git branch -D <branch>`) to maintain visual Git branch diagrams (`|\ ... |/`) in Git network graphs while preserving all granular commit history for Release Please.
5. **Mandatory Granular & Atomic Commits Standard**:
   - **Never Bundle Multiple Unrelated Features into a Single Monolithic Commit**: When implementing multiple features, fixes, or modules, create independent, atomic commits for each logical unit of work.
   - **Release Please Multi-Feature Changelogs**: Granular conventional commit headers ensure that Google Release Please generates rich, comprehensive changelogs populated with distinct entries under `### Features` and `### Bug Fixes`.
   - **Surgical Rollback & Auditability**: Atomic commits enable precise `git bisect` tracking and surgical `git revert` operations without rolling back unrelated functionality.
   - **Always Commit with Detailed Information**:
     - Never make short, vague, or one-liner commit messages (e.g., avoid `fix: updates` or `feat: changes`).
     - Every commit message MUST include:
       - A conventional commit header (`feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`).
       - A bulleted description detailing *what* changed across files/modules.
       - The architectural rationale (*why*).
       - Verification confirmation (e.g., `npm run build` and unit test status).
6. **Mandatory Post-Change README Walkthrough & Architecture Diagram Sync**:
   - After completing ANY code modification, bug fix, or feature addition, the AI agent MUST perform a thorough review and walkthrough of `README.md`.
   - Ensure complete documentation parity: all new inputs, environment variables, model defaults, provider capabilities, or workflow examples must be accurately reflected in `README.md`, regardless of whether README changes were explicitly requested.
   - **Mandatory Architecture Diagram & Asset Generation**:
     - Whenever the architecture diagram or workflow changes, ensure the Mermaid block in `README.md` and `images/architecture-diagram.mmd` remain 100% character-for-character identical (enforced by `npm test`).
     - ALWAYS regenerate the SVG and high-resolution PNG image assets using:
       ```bash
       npx -y @mermaid-js/mermaid-cli \
         -i images/architecture-diagram.mmd \
         -o images/architecture-diagram.svg -b white && \
       npx -y @mermaid-js/mermaid-cli \
         -i images/architecture-diagram.mmd \
         -o images/architecture-diagram.png \
         -b white -s 5
       ```
7. **Automated Changelog & Releases via Google Release Please**:
   - The repository uses **Google Release Please** (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`) to automate semver version bumps, GitHub Releases, and `CHANGELOG.md` updates.
   - **No Manual Changelog Edits Required**: Because Release Please parses Git history automatically, engineers and AI agents do NOT need to manually edit `CHANGELOG.md` on every release. Release Please opens an automated Release PR directly against `main` containing the updated changelog and version bumps.
   - **Mandatory Conventional Commits Standard**: For Release Please to accurately determine version bumps and populate the changelog, every commit header MUST adhere strictly to [Conventional Commits](https://www.conventionalcommits.org/):
     - `feat(...)` — triggers a **Minor** bump (`1.0.0` → `1.1.0`) and populates `### Features`
     - `fix(...)` — triggers a **Patch** bump (`1.0.0` → `1.0.1`) and populates `### Bug Fixes`
     - `perf(...)` — triggers a **Patch** bump and populates `### Performance Improvements`
     - `feat(...)!:` or `BREAKING CHANGE:` — triggers a **Major** bump (`1.0.0` → `2.0.0`)
     - `docs(...)`, `chore(...)`, `test(...)`, `ci(...)`, `refactor(...)` — included in internal release tracking without triggering unnecessary version bumps.

---

## 2. GitHub Actions & Marketplace Standards

1. **Strict GitHub Action Version Integrity Standard**:
   - **NEVER downgrade GitHub Action versions** (e.g., never change `@v7` to `@v4` or `@v4` to `@v2`).
   - **Mandatory Web Search Verification**: Before modifying, touching, or writing any GitHub Action step or version tag (`@v...`), the AI MUST verify the latest releases.
   - **Zero Hallucination / No Assumptions**: Never assume or downgrade versions based on outdated training data memory. Preserve repository-established version tags.
2. **Self-Contained Bundle Rule (`dist/index.js`)**:
   - GitHub Actions runtime must be self-contained. Always bundle TypeScript code into a single zero-dependency production bundle (`dist/index.js`) using `esbuild`.
   - Never require end-users to run `npm install` inside their workflows to execute this action.
3. **Root `action.yml` Standard & Marketplace Description Limit**:
   - `action.yml` must reside strictly in the repository root for GitHub Marketplace discovery.
   - **Marketplace Description Ceiling (< 125 characters)**: The `description` field in `action.yml` MUST be strictly under 125 characters. GitHub Marketplace publishing validation automatically rejects releases if the description is 125 characters or longer.
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
