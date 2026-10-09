# Changelog

All notable changes to **ReviewGround** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Fully Dynamic CI Workflow Job Auto-Discovery (`fetchWorkflowRunJobs()`, `buildDynamicCiSummaryMarkdown()`) — Automatically discovers all running and completed jobs in the workflow run via the GitHub Actions API without hardcoding 4 fixed stages, displaying real job names, statuses, durations, and log links
- Flexible API Key & Base URL Aliases — Added support for popular shorthand and platform aliases: `GEMINI_KEY`, `GROQ_KEY`, `OPENROUTER_KEY`, `OPENAI_KEY`, `ANTHROPIC_KEY`, `CLAUDE_KEY`, `DEEPSEEK_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_HOST`, and `CUSTOM_API_KEY`
- `hasCiData()` & Smart CI Verification Auto-Skip — In `mode: all` (default), automatically suppresses the Post-CI verification table if no CI stage results (`gitleaks-result`, `audit-result`, `build-result`, `test-result`, `extra-stages`) or matching workflow jobs are detected, eliminating noisy `unknown` status rows
- Actionable missing-key setup guidance PR comments — When a pull request runs without any configured LLM API keys, ReviewGround posts a clean, interactive setup banner on the PR with direct links to free provider keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`)
- Diagnostic failure notifications on PR comments — When all configured AI providers fail due to quota exhaustion, rate limits, or network timeouts, posts a diagnostic notice linking to GitHub Actions run logs
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

### Fixed
- **TypeScript Node Globals Resolution**: Added `"types": ["node"]` to `tsconfig.json` compilerOptions to guarantee global `process`, `console`, and `fetch` type declarations under NodeNext ESM packages (e.g. `@actions/core` v3)
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
- Prominently documented execution modes (`mode: review`, `mode: summary`, `mode: all`) in `README.md` and defaulted Quickstart workflow examples to `mode: review`
- Updated `action.yml` description for `mode` input to document Smart CI Verification Auto-Skip
- Review prompt is now dynamically generated based on `review-level` — reduces noise in `critical` mode
- All 7 provider adapters now use shared `fetchWithRetry` instead of raw `fetch` + `AbortSignal.timeout` — adds automatic retry resilience with no behavior change for the happy path
- `AGENTS.md` rule #7 added: mandatory CHANGELOG.md update required after every code change

---


## [1.0.0] - 2026-10-09

### Added
- Initial public release of **ReviewGround** GitHub Action
- Multi-Provider BYOK engine: Gemini, OpenAI (GPT-4o), Anthropic Claude, Groq LPU, DeepSeek, OpenRouter, Custom/Ollama
- Smart auto-detection of provider from model name prefix
- Automatic provider failover chain when primary provider hits quota or errors
- Live npm registry search grounding — verifies package versions before LLM prompt to eliminate hallucinations
- Google Search tool grounding for Gemini provider (`enable-search-grounding`)
- Native GitHub 1-click `[ Apply suggestion ]` inline commit buttons (`enable-inline-suggestions`)
- Sticky PR comment pattern — single comment updated via PATCH (no duplicate spam)
- Post-CI summary table with status badges and real stage duration metrics (`9s`, `1m 24s`)
- GitHub Actions Step Summary integration
- Zero-commit model/provider switching via GitHub Repository Variables
- Automatic PR number detection from GitHub event payload
- Dependabot/bot PR detection — skips review gracefully without failing CI
- Dual diff strategy: local `git diff` with GitHub Pulls API fallback
- Zod v4 schema validation for all inline suggestions (coerces string line numbers)
- Node 24 LTS runtime, TypeScript 7.0, zero-dependency bundle via esbuild (<1MB)
- AGPL-3.0 open-source license
- Self-dogfooding: ReviewGround reviews its own PRs in CI

[Unreleased]: https://github.com/arungupta1526/ReviewGround/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/arungupta1526/ReviewGround/releases/tag/v1.0.0
