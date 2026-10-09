# Changelog

All notable changes to **ReviewGround** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `temperature` input — controls LLM sampling temperature (0.0–1.0, default `0.2`)
- `max-tokens` input — controls maximum AI response tokens (default `2048`)
- `review-level` input — `critical` (bugs & security only), `standard` (default), `comprehensive` (all + style)
- `ignore-patterns` input — comma-separated glob patterns to exclude files from AI review (e.g. `dist/**,*.min.js`)
- Repository custom rules support — loads repo-specific guidelines from `.reviewground.yml`, `.reviewground.yaml`, or `.github/reviewground.yml`
- `truncateDiffClean()` — smart diff truncation at clean hunk boundaries, prevents malformed diffs reaching LLMs
- Paginated comment search — handles PRs with >100 comments without duplicate sticky comments
- Visible warning when Groq provider truncates large diffs at 16,000 chars
- Informational log when inline suggestion count is capped at 5

### Fixed
- **Bug #1**: Hard diff truncation at 32,000 chars could cut mid-hunk — now truncates at clean `diff --git` boundaries
- **Bug #2**: Sticky comment lookup only searched first 100 PR comments — fixed with full paginated lookup
- **Bug #3**: `fs.appendFileSync` used inside async context — replaced with `await fs.promises.appendFile`
- **Bug #4**: Groq 16,000-char prompt truncation was silent — now emits a visible `⚠️` CI warning
- **Bug #5**: `detectProviderFromModel` missed `o4`, `o4-mini` OpenAI models — added `o4` prefix detection
- **Bug #6**: Inline suggestion cap of 5 was applied silently — now logs count vs cap clearly
- **Action Parser Fix**: Removed embedded `${{ needs... }}` expressions from `action.yml` input descriptions which caused GitHub Actions workflow runner crashes
- **Bot PR Safety**: Early detection and graceful skip of automated bot PRs (e.g. `dependabot[bot]`) before provider initialization

### Changed
- Review prompt is now dynamically generated based on `review-level` — reduces noise in `critical` mode

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
