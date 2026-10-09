<div align="center">

# 🛡️ ReviewGround

**The Universal AI Code Reviewer & Post-CI Verification Engine for GitHub Actions.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-v1-purple.svg?logo=githubactions)](https://github.com/marketplace/actions/reviewground)
[![Node Runtime](https://img.shields.io/badge/Node-20%2B-green.svg?logo=node.js)](package.json)
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
| **Provider Freedom** | Locked into single proprietary model | **Gemini, OpenAI, Claude, Groq, DeepSeek, Ollama** |
| **Hallucination Prevention** | None (frequently flags modern packages as fake) | **Real-Time NPM Registry Search Grounding** |
| **Commit Suggestions** | Text markdown diff blocks | **Native GitHub 1-Click `[ Apply suggestion ]` Buttons** |
| **PR Comment Noise** | Spams 5–10 new comments per PR push | **Single In-Place Sticky Comment (Updated via PATCH)** |
| **CI Duration Tracking** | Not supported | **Workflow Jobs API Duration Metrics (`9s`, `1m 24s`)** |
| **Local / Air-Gapped AI** | Not supported | **Self-hosted Ollama / vLLM / OpenRouter compatible** |

---

## ⚡ Quickstart (Under 60 Seconds)

Create `.github/workflows/reviewground.yml` in your repository:

```yaml
name: ReviewGround AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  review:
    name: 🤖 AI Code Review
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for complete git diff comparison

      - name: Run ReviewGround
        uses: reviewground/reviewground@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # Provide ANY key(s) you have. ReviewGround auto-detects and fails over gracefully:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          groq-api-key: ${{ secrets.GROQ_API_KEY }}
          deepseek-api-key: ${{ secrets.DEEPSEEK_API_KEY }}
```

---

## 🚀 Key Architectural Pillars

### 1. 🌐 Live Registry Grounding & NPM Zero-Hallucination
LLMs trained with cutoffs often hallucinate that newly released major libraries or toolchains don't exist (e.g. Node 24, Next.js 15, Zod 4, TypeScript 7).  
ReviewGround parses every package added in your diff and proactively inspects `registry.npmjs.org` in real time, injecting confirmed releases as ground-truth context before prompting the LLM. For Gemini, Google Search tool grounding (`tools: [{ googleSearch: {} }]`) is also enabled automatically.

### 2. 🖱️ Native 1-Click Commit Suggestions
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

### 3. 📌 Single Sticky In-Place PR Comment
ReviewGround detects previous comments using a persistent HTML marker (`<!-- reviewground-code-review -->`) and updates them using `PATCH /repos/{owner}/{repo}/issues/comments/{id}`.  
- New commits update the existing review.
- CI results and duration metrics update the status table below the review.
- PR conversation history remains clean and spam-free.

### 4. ⏱️ Stage Execution Duration Metrics
Queries the GitHub Actions Workflow Jobs API (`/actions/runs/{run_id}/jobs`) to compute exact run times for each verification stage:

| Pipeline Stage | Status | Duration | Verification Summary |
|---|:---:|:---:|---|
| 🐍 **1. Gitleaks Secret Scan** | ✅ Passed | `8s` | Secret, token & credential leak detection |
| 🐍 **2. Dependency Audit** | ✅ Passed | `14s` | Security vulnerability & zero-CVE audit |
| 🐍 **3. Build & Compilation** | ✅ Passed | `42s` | Clean build compilation & type safety |
| 🐍 **4. Test Verification** | ✅ Passed | `1m 15s` | Unit tests & invariant suites |

---

## 🔑 Multi-Provider BYOK Engine

ReviewGround supports all major AI providers out of the box with automatic discovery and multi-model failover:

### 1. Google Gemini (Recommended Default)
- **Secret**: `GEMINI_API_KEY`
- **Default Model**: `gemini-2.5-flash` (with automated failover to `gemini-2.5-flash-lite`)
- **Features**: Real-time Google Search grounding enabled.

### 2. OpenAI
- **Secret**: `OPENAI_API_KEY`
- **Default Model**: `gpt-4o-mini` (fallback to `gpt-4o`)

### 3. Anthropic Claude
- **Secret**: `ANTHROPIC_API_KEY`
- **Default Model**: `claude-3-5-sonnet-20241022` (fallback to `claude-3-5-haiku-20241022`)

### 4. Groq LPU (Ultra-Fast)
- **Secret**: `GROQ_API_KEY`
- **Default Model**: `llama-3.3-70b-versatile` (fallback to `qwen/qwen3.8-27b`)

### 5. DeepSeek
- **Secret**: `DEEPSEEK_API_KEY`
- **Default Model**: `deepseek-chat` (DeepSeek-V3, fallback to `deepseek-reasoner` / R1)

### 6. Local / Custom Endpoint (Ollama / OpenRouter / vLLM)
- **Inputs**: `llm-base-url: 'http://localhost:11434/v1'`, `llm-api-key: 'optional'`
- **Default Model**: Configurable via `model: 'llama3.2'`

---

## 🛠️ Complete Configuration Reference

### Action Inputs

| Input | Description | Default |
|---|---|:---:|
| `github-token` | GitHub token (`pull-requests:write` permission required) | `${{ github.token }}` |
| `mode` | Execution mode: `review`, `summary`, or `all` | `all` |
| `provider` | Preferred AI provider: `gemini`, `openai`, `anthropic`, `groq`, `deepseek`, `custom` | *Auto-detected* |
| `model` | Model name override for the active provider | *Provider default* |
| `gemini-api-key` | Google Gemini API key | `${{ secrets.GEMINI_API_KEY }}` |
| `openai-api-key` | OpenAI API key | `${{ secrets.OPENAI_API_KEY }}` |
| `anthropic-api-key` | Anthropic Claude API key | `${{ secrets.ANTHROPIC_API_KEY }}` |
| `groq-api-key` | Groq API key | `${{ secrets.GROQ_API_KEY }}` |
| `deepseek-api-key` | DeepSeek API key | `${{ secrets.DEEPSEEK_API_KEY }}` |
| `llm-base-url` | Custom OpenAI-compatible URL (e.g. `http://localhost:11434/v1`) | — |
| `llm-api-key` | API key for custom endpoint | — |
| `enable-search-grounding`| Enable Google Search grounding for Gemini | `true` |
| `enable-inline-suggestions`| Post 1-click interactive commit buttons on diffs | `true` |
| `enable-npm-verify` | Verify package versions against live npm registry | `true` |
| `base-branch` | Base branch to compare diff against | `main` |
| `gitleaks-result` | Result of Gitleaks stage (`success`, `failure`) | — |
| `audit-result` | Result of Dependency Audit stage | — |
| `build-result` | Result of Build stage | — |
| `test-result` | Result of Test stage | — |

### Action Outputs

| Output | Description |
|---|---|
| `reviewed` | `"true"` if an AI review was successfully generated |
| `reviewer-engine` | The provider and model that generated the review (e.g. `Google Gemini (gemini-2.5-flash)`) |
| `summarized` | `"true"` if the CI pipeline summary was rendered |
| `summary-markdown`| The rendered markdown table of the CI summary |

---

## 🧩 Advanced: Full CI Pipeline with Post-CI Verification Table

```yaml
name: CI & ReviewGround Verification

on:
  pull_request:
    branches: [ main ]

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  # 1. Secret scanning
  gitleaks:
    name: 1. Gitleaks Secret Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2

  # 2. Dependency audit
  audit:
    name: 2. Dependency Audit
    needs: [gitleaks]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm audit --audit-level=high

  # 3. Build
  build:
    name: 3. Build & Compilation
    needs: [audit]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build

  # 4. Tests
  test:
    name: 4. Unit Tests
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm test

  # 5. ReviewGround: Review + Sticky Status
  reviewground:
    name: 5. ReviewGround AI Review & Status
    needs: [gitleaks, audit, build, test]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: reviewground/reviewground@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          gitleaks-result: ${{ needs.gitleaks.result }}
          audit-result: ${{ needs.audit.result }}
          build-result: ${{ needs.build.result }}
          test-result: ${{ needs.test.result }}
```

---

## 📄 License & Open-Core Model

ReviewGround is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.  
- ✅ **Free to use** for open-source projects, personal repositories, and internal enterprise organizations.
- 🛡️ **Protects against closed-source cloud SaaS clones**: Any company offering ReviewGround as a hosted commercial SaaS service must contribute their modifications back under AGPLv3.

---

<div align="center">
Built with ❤️ for software engineering teams worldwide.
</div>
