# Changelog

All notable changes to **ReviewGround** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0](https://github.com/arungupta1526/ReviewGround/compare/v1.3.0...v1.4.0) (2026-10-10)


### Features

* **ci:** add skip-on-ci-failure input to pause review on broken builds ([3955714](https://github.com/arungupta1526/ReviewGround/commit/39557148a612f3f78f4af6d7a223a30ddffe341d))
* **commands:** support conversational PR comment questions and queries ([b384f88](https://github.com/arungupta1526/ReviewGround/commit/b384f88364793fc63c0ae2846c6a390917a8a6c9))
* **context:** add lightweight repo structure grounder to eliminate utility hallucinations ([65f0b84](https://github.com/arungupta1526/ReviewGround/commit/65f0b84cf500346be96f09c061020404de124682))
* **github:** add configurable enable-prune-inline-suggestions action input ([245b801](https://github.com/arungupta1526/ReviewGround/commit/245b80125af15971b82ac606137730c022605e6b))
* **github:** auto-resolve outdated review threads and enforce pagination bounds ([403052d](https://github.com/arungupta1526/ReviewGround/commit/403052d92cf9734e94ddff55dd323a82e564a4c9))
* **metrics:** add model-aware pricing, 5x architecture diagram, and file tree docs ([6bcf93b](https://github.com/arungupta1526/ReviewGround/commit/6bcf93bcbb2910d8ad9ba0395ffc40149120caca))
* **metrics:** track cumulative multi-run PR spend and per-CI cost breakdown ([60ab391](https://github.com/arungupta1526/ReviewGround/commit/60ab391a5658bd292b2fdd7d0a715a9615c36a46))
* **rules:** auto-ingest guidelines from AGENTS.md, .cursorrules, and CLAUDE.md ([000b5d5](https://github.com/arungupta1526/ReviewGround/commit/000b5d59f1fb029ab9821fdeedd8ad2c7b56f3b0))
* **security:** implement pre-flight diff secret and credential masking ([c67bddf](https://github.com/arungupta1526/ReviewGround/commit/c67bddf538ce0b7979f30666c21d14123e08b860))


### Bug Fixes

* **checks:** ensure unicode surrogate pair safe slicing for check runs ([2ba6928](https://github.com/arungupta1526/ReviewGround/commit/2ba69287fff246b7c64b96dbc8034b9f161bdaad))
* **github:** sanitize repo parameters, add execSync buffer guards, and add modular unit tests ([77f330c](https://github.com/arungupta1526/ReviewGround/commit/77f330cbb13538547957510d23bf43d22cf7b48b))
* **security:** batch resolve review threads and sanitize pr numbers ([193b289](https://github.com/arungupta1526/ReviewGround/commit/193b289c10299d9252cfc9096bf5ed4d08e3de0e))
* **security:** eliminate os command injection in git diff using execFileSync ([5d8e9ac](https://github.com/arungupta1526/ReviewGround/commit/5d8e9ac025133329eb33d190580bbe6c2ba5d0cd))
* **security:** sanitize suggestion backticks and improve pr description regex ([c2e8e43](https://github.com/arungupta1526/ReviewGround/commit/c2e8e4374235d9b1a2a913cbe62a157f4662ac42))

## [1.3.0](https://github.com/arungupta1526/ReviewGround/compare/v1.2.0...v1.3.0) (2026-10-10)


### Features

* **v1.3.0:** complete 7-feature competitive suite (slash commands, walkthrough describer, multi-registry, cost footer, smart diff, OWASP, test stubs) ([1130da4](https://github.com/arungupta1526/ReviewGround/commit/1130da496ebf7e70cae5965b4baf815d5d21b82d))

## [1.2.0](https://github.com/arungupta1526/ReviewGround/compare/v1.1.0...v1.2.0) - 2026-10-10

### Features & Maintenance
- **Automated Semver Release & Synchronization** — Synchronized version manifest and package dependencies with Google Release Please automated release cycle.

---

## [1.1.0](https://github.com/arungupta1526/ReviewGround/compare/v1.0.0...v1.1.0) - 2026-10-10

### Features & Additions
- **Fully Dynamic CI Workflow Job Auto-Discovery** (`fetchWorkflowRunJobs()`, `buildDynamicCiSummaryMarkdown()`) — Automatically discovers all running and completed jobs in the workflow run via the GitHub Actions API without hardcoding 4 fixed stages, displaying real job names, statuses, durations, and log links
- **Smart CI Verification Auto-Skip** (`hasCiData()`) — In `mode: all` (default), automatically suppresses the Post-CI verification table if no CI stage results (`gitleaks-result`, `audit-result`, `build-result`, `test-result`, `extra-stages`) or matching workflow jobs are detected, eliminating noisy `unknown` status rows
- **Actionable Missing-Key Setup Guidance** — When a pull request runs without any configured LLM API keys, ReviewGround posts a clean, interactive setup banner on the PR with direct links to free provider keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`)
- **Diagnostic Failure Notifications** — When all configured AI providers fail due to quota exhaustion, rate limits, or network timeouts, posts a diagnostic notice linking to GitHub Actions run logs
- **ReviewGround Header Branding** — Standardized review comment headers to `## 🛡️ ReviewGround AI Code Review & Security Analysis`
- **Collapsible UI Screenshots & Option 6 Config** — Added live demo screenshots with hidden `<details>` accordion and exhaustive configuration examples in `README.md`
- **Flexible Secret Aliases** — Added support for popular shorthand and platform aliases: `GEMINI_KEY`, `GROQ_KEY`, `OPENROUTER_KEY`, `OPENAI_KEY`, `ANTHROPIC_KEY`, `CLAUDE_KEY`, `DEEPSEEK_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_HOST`, and `CUSTOM_API_KEY`
- **Google Release Please Automation** — Configured `.github/workflows/release-please.yml` for automated semver releases and floating `v1` major tag management

### Changed
- Prominently documented execution modes (`mode: review`, `mode: summary`, `mode: all`) in `README.md` and defaulted Quickstart workflow examples to `mode: review`
- Standardized all workflow configuration examples in `README.md` to pass provider API keys and custom endpoints via GitHub Actions `env:` environment blocks instead of `with:` action inputs
- Updated `action.yml` description for `mode` input to document Smart CI Verification Auto-Skip

---

## [1.0.0] - 2026-10-09

### Added
- Initial public release of **ReviewGround** GitHub Action on GitHub Marketplace
- Multi-Provider BYOK engine: Gemini, OpenAI (GPT-4o), Anthropic Claude, Groq LPU, DeepSeek, OpenRouter, Custom/Ollama
- Smart auto-detection of provider from model name prefix
- Automatic provider failover chain when primary provider hits quota or errors
- `fallback-models` input — comma-separated list of secondary models and providers to try sequentially upon failures
- First-class `OpenRouterProvider` adapter with full model pass-through and optional site attribution headers (`HTTP-Referer`, `X-Title`)
- Live npm registry search grounding — verifies package versions before LLM prompt to eliminate hallucinations
- Google Search tool grounding for Gemini provider (`enable-search-grounding`)
- Native GitHub 1-click `[ Apply suggestion ]` inline commit buttons (`enable-inline-suggestions`)
- Sticky PR comment pattern — single comment updated via PATCH (no duplicate spam)
- Post-CI summary table with status badges and real stage duration metrics (`9s`, `1m 24s`)
- GitHub Actions Step Summary integration
- Zero-commit model and provider switching via GitHub Repository Variables (`REVIEWGROUND_MODEL`, `REVIEWGROUND_PROVIDER`, `REVIEWGROUND_REVIEW_LEVEL`)
- Automatic PR number detection from GitHub event payload
- Dependabot/bot PR detection — skips review gracefully without failing CI
- Dual diff strategy: local `git diff` with GitHub Pulls API fallback
- Zod v4 schema validation for all inline suggestions (coerces string line numbers)
- Node 24 LTS runtime, TypeScript 7.0, zero-dependency bundle via esbuild (<1MB)
- `review-language` input — outputs AI review in any language (`ja`, `es`, `de`, `zh`, `pt`, `fr`, or any BCP-47 code, default `en`)
- `enable-pr-description-update` input — auto-appends 🟢/🟡/🔴 risk badge + AI summary to PR body (opt-in, default `false`)
- `enable-check-run` input — creates a GitHub Check Run pass/fail gate usable in branch protection rules; requires `checks: write` permission (opt-in, default `false`)
- `extra-stages` input — JSON array of extra CI stages appended to the summary table beyond the default 4 (e.g. `[{"name":"Deploy","result":"success"}]`)
- `src/utils/fetchWithRetry.ts` — shared fetch utility with exponential backoff + jitter (50–250ms), retries up to 2 times on transient failures; integrated into all 7 provider adapters
- Provider-specific prompt styles (I7): Claude/Anthropic uses XML `<instructions>/<diff>` tags; Gemini uses structured schema + section guidance; Groq/Qwen/Llama uses `##` markdown headers; all others use the generic prompt
- `updatePrDescription()` function — idempotent PR body updater using `<!-- reviewground-pr-description -->` anchor tag
- `createCheckRun()` function — posts to `/repos/{owner}/{repo}/check-runs` with `failure` or `success` conclusion based on critical keyword detection in review text
- `temperature` input — controls LLM sampling temperature (0.0–1.0, default `0.2`)
- `max-tokens` input — controls maximum AI response tokens (default `2048`)
- `review-level` input — `critical` (bugs & security only), `standard` (default), `comprehensive` (all + style)
- `ignore-patterns` input — comma-separated glob patterns to exclude files from AI review (e.g. `dist/**,*.min.js`)
- Repository custom rules support — loads repo-specific guidelines from `.reviewground.yml`, `.reviewground.yaml`, or `.github/reviewground.yml`
- Smart Dependabot configuration with separate development tooling and production dependency groups
- Upgraded `esbuild` to `0.28.2` with full bundle rebuild
- Upgraded `@actions/core` to `3.0.1` and kept `@types/node` aligned with Node 24 LTS (`24.19.1`)
- `truncateDiffClean()` — smart diff truncation at clean hunk boundaries, prevents malformed diffs reaching LLMs
- Paginated comment search — handles PRs with >100 comments without duplicate sticky comments
- Visible warning when Groq provider truncates large diffs at 16,000 chars
- Informational log when inline suggestion count is capped at 5
- Verified competitive comparison matrix vs CodeRabbit, Qodo, PR-Agent, and Copilot in `README.md`
- Expanded Mermaid end-to-end workflow architecture diagram with repository guidelines, merge gates, and extra stages in `README.md`
- AGPL-3.0 open-source license
- Self-dogfooding: ReviewGround reviews its own PRs in CI

### Fixed
- **TypeScript Node Globals Resolution**: Added `"types": ["node"]` to `tsconfig.json` compilerOptions to guarantee global `process`, `console`, and `fetch` type declarations under NodeNext ESM packages (e.g. `@actions/core` v3)
- **Active Model Endpoints**: Updated Gemini defaults to active endpoints (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`) and Groq models to `qwen/qwen3.8-27b` and `openai/gpt-oss-120b` to eliminate 404 deprecated model errors
- **Custom Model Routing Preservation**: Preserved custom provider endpoints (`custom`, `openrouter`) without accidental hijacking or rerouting to fallback models
- **Bug #1**: Hard diff truncation at 32,000 chars could cut mid-hunk — now truncates at clean `diff --git` boundaries
- **Bug #2**: Sticky comment lookup only searched first 100 PR comments — fixed with full paginated lookup
- **Bug #3**: `fs.appendFileSync` used inside async context — replaced with `await fs.promises.appendFile`
- **Bug #4**: Groq 16,000-char prompt truncation was silent — now emits a visible `⚠️` CI warning
- **Bug #5**: `detectProviderFromModel` missed `o4`, `o4-mini` OpenAI models — added `o4` prefix detection
- **Bug #6**: Inline suggestion cap of 5 was applied silently — now logs count vs cap clearly
- **Action Parser Fix**: Removed embedded `${{ needs... }}` expressions from `action.yml` input descriptions which caused GitHub Actions workflow runner crashes
- **Bot PR Safety**: Early detection and graceful skip of automated bot PRs (e.g. `dependabot[bot]`) before provider initialization
- **Marketplace Description Limit**: Shortened `action.yml` description to 114 characters to comply with GitHub Marketplace's strict 125-character maximum requirement

### Changed
- Review prompt is now dynamically generated based on `review-level` — reduces noise in `critical` mode
- All 7 provider adapters now use shared `fetchWithRetry` instead of raw `fetch` + `AbortSignal.timeout` — adds automatic retry resilience with no behavior change for the happy path
- `AGENTS.md` rule #7 added: mandatory CHANGELOG.md update required after every code change

[1.2.0]: https://github.com/arungupta1526/ReviewGround/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/arungupta1526/ReviewGround/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/arungupta1526/ReviewGround/releases/tag/v1.0.0
