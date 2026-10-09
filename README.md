<div align="center">

# 🛡️ ReviewGround

**The Universal, High-Precision AI Code Reviewer & Post-CI Verification Engine for GitHub Actions.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-v1-purple.svg?logo=githubactions)](https://github.com/marketplace/actions/reviewground)
[![Node Runtime](https://img.shields.io/badge/Node-24%20LTS-green.svg?logo=node.js)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-blue.svg?logo=typescript)](package.json)
[![Zod](https://img.shields.io/badge/Zod-4.6.5-3E67B1.svg?logo=zod)](package.json)
[![BYOK Multi-Provider](https://img.shields.io/badge/BYOK-Gemini%20%7C%20OpenAI%20%7C%20Claude%20%7C%20Groq%20%7C%20DeepSeek-orange.svg)](#-multi-provider-byok-engine)
[![Security: 0 Vulnerabilities](https://img.shields.io/badge/Security-0%20Vulnerabilities-success.svg)](package.json)

*Stop paying $50/seat/month for proprietary AI code review bots.*  
**ReviewGround** brings enterprise-grade AI code review, live package registry grounding, 1-click commit suggestions, and sticky CI summaries directly to your repository with your own API keys.

---

</div>

## 🌟 Why ReviewGround?

| Feature | Standard AI Review Bots | ReviewGround |
|---|:---:|:---:|
| **Pricing** | $20–$60 / developer / month | **100% Free & Open-Core (BYOK)** |
| **Provider Freedom** | Locked into single proprietary vendor | **Gemini, OpenAI, Claude, Groq, DeepSeek, Ollama** |
| **Model Customization** | Fixed models only | **Full Custom Model Override (`model: '...'`)** |
| **Hallucination Prevention** | None (flags modern packages as non-existent) | **Real-Time NPM Registry Search Grounding** |
| **Commit Suggestions** | Markdown text diff blocks | **Native GitHub 1-Click `[ Apply suggestion ]` Buttons** |
| **PR Comment Noise** | Spams 5–10 new comments per PR push | **Single In-Place Sticky Comment (Updated via PATCH)** |
| **CI Duration Tracking** | Not supported | **Workflow Jobs API Duration Metrics (`9s`, `1m 24s`)** |
| **Local / Air-Gapped AI** | Not supported | **Self-hosted Ollama / vLLM / OpenRouter compatible** |

---

## 🚀 Key Architectural Pillars

### 1. 🌐 Google Search Grounding & NPM Live Registry Check
LLMs trained with static cutoffs frequently hallucinate that newly released major versions or frameworks do not exist (e.g. Node 24, Next.js 15, Zod 4, TypeScript 7).  
ReviewGround parses every package added in your diff and proactively inspects `registry.npmjs.org` in real-time, injecting verified releases as ground-truth context before prompting the LLM. For Gemini, Google Search tool grounding (`tools: [{ googleSearch: {} }]`) is enabled automatically with graceful fallback.

### 2. ⚡ Native 1-Click Commit Suggestions on PR Diffs
Instead of dumping passive code blocks in a comment, ReviewGround formats fixes into the GitHub Pull Request Review Comments API.  
Developers can apply fixes with native GitHub buttons directly in the **Files changed** tab:
```
┌────────────────────────────────────────────────────────┐
│  src/auth/jwt.ts:42                                    │
│  🤖 ReviewGround 1-Click Code Suggestion               │
│  ```suggestion                                         │
│    const payload = jwt.verify(token, secretKey);       │
│  ```                                                   │
│  [ Apply suggestion ]   [ Add suggestion to batch ]    │
└────────────────────────────────────────────────────────┘
```
All line numbers are validated and safely coerced with **Zod 4.6.5** schemas (`InlineSuggestionsListSchema`), preventing runtime crashes when LLMs return string line numbers.

### 3. 📊 Post-CI Single Sticky PR Summary & Stage Durations
ReviewGround detects previous comments using a persistent HTML marker (`<!-- reviewground-code-review -->`) and updates them using `PATCH /repos/{owner}/{repo}/issues/comments/{id}`.  
- New commits update the existing review in-place without comment spam.
- Queries GitHub Actions Workflow Jobs API (`/actions/runs/{run_id}/jobs`) to compute exact execution durations:

| Pipeline Stage | Status | Duration | Verification Summary |
|---|:---:|:---:|---|
| 🐍 **1. Gitleaks Secret Scan** | ✅ Passed | `8s` | Secret, token & credential leak detection |
| 🐍 **2. Dependency Audit** | ✅ Passed | `14s` | Security vulnerability & zero-CVE audit |
| 🐍 **3. Build & Compilation** | ✅ Passed | `42s` | Clean build compilation & type safety |
| 🐍 **4. Test Verification** | ✅ Passed | `1m 15s` | Unit tests & invariant suites |

### 4. 🤖 Multi-Provider BYOK (Bring Your Own Key) Engine
Automatically detects configured API keys and supports automatic multi-provider failover:
- **Google Gemini**: Default `gemini-3.5-flash-lite` (supports `gemini-3.1-flash-lite`, `gemini-2.5-flash`)
- **OpenAI**: Default `gpt-4o-mini` (fallback `gpt-4o`)
- **Anthropic Claude**: Default `claude-3-5-haiku` (fallback `claude-3-5-sonnet`)
- **Groq LPU**: Default `llama-3.3-70b-versatile` (fallback `qwen/qwen3.8-27b`)
- **DeepSeek**: Default `deepseek-chat` (V3, fallback `deepseek-reasoner` / R1)
- **Custom / Local**: Any OpenAI-compatible endpoint (Ollama, OpenRouter, vLLM)

---

## ⚡ Quickstart Workflows

### Example 1: Google Gemini (Free & Search Grounded)

```yaml
name: ReviewGround AI Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: reviewground/reviewground@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

---

### Example 2: Multi-Provider with Automatic Failover

If Gemini hits a quota or rate-limit, ReviewGround seamlessly falls over to Groq or OpenAI:

```yaml
name: ReviewGround Multi-Provider Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: reviewground/reviewground@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          groq-api-key: ${{ secrets.GROQ_API_KEY }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

---

### Example 3: Custom Model Name Override

Override provider defaults with any specific model:

```yaml
name: ReviewGround Custom Model Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: reviewground/reviewground@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          provider: 'openai'
          model: 'gpt-4o' # Custom model override takes highest priority!
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

---

### Example 4: Local / Self-Hosted LLM (Ollama or OpenRouter)

```yaml
name: ReviewGround Self-Hosted Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: reviewground/reviewground@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          provider: 'custom'
          llm-base-url: 'https://openrouter.ai/api/v1' # or http://localhost:11434/v1
          llm-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          model: 'meta-llama/llama-3.3-70b-instruct'
```

---

## 🛠️ Complete Configuration Reference

### Action Inputs

| Input | Description | Default |
|---|---|:---:|
| `github-token` | GitHub token with `pull-requests:write` permission | `${{ github.token }}` |
| `mode` | Execution mode: `review`, `summary`, or `all` | `all` |
| `provider` | Preferred AI provider: `gemini`, `openai`, `anthropic`, `groq`, `deepseek`, `custom` | *Auto-detected* |
| `model` | Custom model name override (Highest priority over all provider defaults) | *Provider default* |
| `gemini-api-key` | Google Gemini API key | `${{ secrets.GEMINI_API_KEY }}` |
| `openai-api-key` | OpenAI API key | `${{ secrets.OPENAI_API_KEY }}` |
| `anthropic-api-key` | Anthropic Claude API key | `${{ secrets.ANTHROPIC_API_KEY }}` |
| `groq-api-key` | Groq API key | `${{ secrets.GROQ_API_KEY }}` |
| `deepseek-api-key` | DeepSeek API key | `${{ secrets.DEEPSEEK_API_KEY }}` |
| `llm-base-url` | Custom OpenAI-compatible URL (e.g. `http://localhost:11434/v1`) | — |
| `llm-api-key` | API key for custom endpoint (optional for local Ollama) | — |
| `enable-search-grounding`| Enable Google Search grounding for Gemini | `true` |
| `enable-inline-suggestions`| Post 1-click interactive commit buttons on diffs | `true` |
| `enable-npm-verify` | Verify package versions against live npm registry | `true` |
| `base-branch` | Base branch to compare diff against | `main` |
| `comment-tag` | Unique HTML comment tag to identify sticky PR comments | `<!-- reviewground-code-review -->` |
| `gitleaks-result` | Result of Gitleaks stage (`success`, `failure`) | — |
| `audit-result` | Result of Dependency Audit stage | — |
| `build-result` | Result of Build stage | — |
| `test-result` | Result of Test stage | — |

### Action Outputs

| Output | Description |
|---|---|
| `reviewed` | `"true"` if an AI review was successfully generated |
| `reviewer-engine` | The provider and model that generated the review (e.g. `Google Gemini (gemini-3.5-flash-lite)`) |
| `summarized` | `"true"` if the CI pipeline summary was rendered |
| `summary-markdown`| The rendered markdown table of the CI summary and stage durations |

---

## 📄 License & Open-Core Model

ReviewGround is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.  
- ✅ **Free to use** for open-source projects, personal repositories, and internal enterprise organizations.
- 🛡️ **Protects against closed-source cloud SaaS clones**: Any company offering ReviewGround as a hosted commercial SaaS service must contribute their modifications back under AGPLv3.

---

<div align="center">
Built with ❤️ for software engineering teams worldwide.
</div>
