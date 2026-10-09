<div align="center">

# 🛡️ ReviewGround

**The Universal, High-Precision AI Code Reviewer & Post-CI Verification Engine for GitHub Actions.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-v1-purple.svg?logo=githubactions)](https://github.com/marketplace/actions/reviewground)
[![Node Runtime](https://img.shields.io/badge/Node-24%20LTS-green.svg?logo=node.js)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-blue.svg?logo=typescript)](package.json)
[![Zod](https://img.shields.io/badge/Zod-4.6.5-3E67B1.svg?logo=zod)](package.json)
[![BYOK Multi-Provider](https://img.shields.io/badge/BYOK-Gemini%20%7C%20OpenAI%20%7C%20Claude%20%7C%20Groq%20%7C%20DeepSeek-orange.svg)](#-how-to-get-api-keys--configure-github)
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
| **Zero-Commit Control** | Must edit YAML & commit for model changes | **Change Provider/Model via GitHub Repo Variables** |
| **Hallucination Prevention** | None (flags modern packages as non-existent) | **Real-Time NPM Registry Search Grounding** |
| **Commit Suggestions** | Markdown text diff blocks | **Native GitHub 1-Click `[ Apply suggestion ]` Buttons** |
| **PR Comment Noise** | Spams 5–10 new comments per PR push | **Single In-Place Sticky Comment (Updated via PATCH)** |
| **CI Duration Tracking** | Not supported | **Workflow Jobs API Duration Metrics (`9s`, `1m 24s`)** |
| **Local / Air-Gapped AI** | Not supported | **Self-hosted Ollama / vLLM / OpenRouter compatible** |

---

## 🔑 How to Get API Keys & Configure GitHub

You bring your own API key(s) from any provider you prefer. ReviewGround supports multiple keys with automatic failover!

### 1. Direct Links to Get Your API Keys

| Provider | Recommended Baseline | Free Tier Available? | Get Your API Key (Direct Link) |
|---|---|:---:|---|
| **Google Gemini** | `gemini-3.5-flash-lite` | ✅ **Yes** | 🔗 [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Groq LPU** | `llama-3.3-70b-versatile` | ✅ **Yes** | 🔗 [Groq Console](https://console.groq.com/keys) |
| **OpenAI** | `gpt-4o-mini` | Paid / Credits | 🔗 [OpenAI Platform](https://platform.openai.com/api-keys) |
| **Anthropic Claude** | `claude-3-5-haiku` | Paid / Credits | 🔗 [Anthropic Console](https://console.anthropic.com/settings/keys) |
| **DeepSeek** | `deepseek-chat` | Paid (Low Cost) | 🔗 [DeepSeek Platform](https://platform.deepseek.com/api_keys) |
| **OpenRouter / Ollama** | Any open model | Varied | 🔗 [OpenRouter Keys](https://openrouter.ai/keys) or `localhost:11434` |

---

### 2. How to Add API Keys & Settings in Your GitHub Repository

You **never** need to commit API keys to your code. Manage them securely in GitHub:

#### Step A: Store API Keys in GitHub Secrets
1. In your GitHub repository, click **Settings** (top tab).
2. In the left navigation menu, navigate to **Secrets and variables** → **Actions**.
3. Under the **Repository secrets** section, click **New repository secret**.
4. Add any keys you have:
   - Name: `GEMINI_API_KEY` | Secret: `AIzaSy...`
   - Name: `OPENAI_API_KEY` | Secret: `sk-proj-...`
   - Name: `ANTHROPIC_API_KEY` | Secret: `sk-ant-...`
   - Name: `GROQ_API_KEY` | Secret: `gsk_...`
   - Name: `DEEPSEEK_API_KEY` | Secret: `sk-...`

#### Step B: Zero-Commit Model & Provider Control (GitHub Variables)
Want to switch models or providers without editing your `.github/workflows` YAML or creating git commits?
1. In **Settings** → **Secrets and variables** → **Actions**, click the **Variables** tab.
2. Click **New repository variable**:
   - Name: `PROVIDER` → Value: `gemini` (or `openai`, `anthropic`, `groq`, `deepseek`)
   - Name: `MODEL` → Value: `gemini-2.5-pro` (or `gpt-4o`, `claude-3-5-sonnet`)
3. Whenever you want to experiment with a new model or switch providers, simply update the variable value in GitHub settings. **ReviewGround picks it up on the very next PR run automatically!**

---

## ⚡ Quickstart Workflows

Create `.github/workflows/reviewground.yml` in your project:

### Option 1: Universal Zero-Commit Setup (Recommended)
This workflow handles API keys from secrets and allows runtime provider/model switching via GitHub Repository Variables (`vars.*`):

```yaml
name: ReviewGround AI Code Review

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
          fetch-depth: 0 # Required for full git diff calculation

      - uses: arungupta1526/ReviewGround@v1
        env:
          # API Keys (Stored in Repository Secrets)
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          # Zero-Commit Dynamic Controls (Configured in Repository Variables)
          PROVIDER: ${{ vars.PROVIDER || '' }}
          MODEL: ${{ vars.MODEL || '' }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

### Option 2: Minimal Gemini Setup (Free Tier)

```yaml
name: ReviewGround Gemini Review

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

      - uses: arungupta1526/ReviewGround@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

---

### Option 3: Explicit Custom Model Override in YAML

```yaml
name: ReviewGround Flagship Model Review

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

      - uses: arungupta1526/ReviewGround@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          provider: 'openai'
          model: 'gpt-4o' # Custom model override takes highest priority!
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

---

### Option 4: Local / Self-Hosted LLM (Ollama or OpenRouter)

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

      - uses: arungupta1526/ReviewGround@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          provider: 'custom'
          llm-base-url: 'https://openrouter.ai/api/v1' # or http://localhost:11434/v1 for Ollama
          llm-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          model: 'meta-llama/llama-3.3-70b-instruct'
```

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

---

## 🛠️ Complete Configuration Reference

### Action Inputs & Environment Variables

Every setting can be passed either as an Action Input (`with:`) or as an Environment Variable / Secret (`env:`):

| Setting | Action Input (`with:`) | Environment Variable (`env:` / `vars.*`) | Default |
|---|---|---|:---:|
| **GitHub Token** | `github-token` | `GITHUB_TOKEN` | `${{ github.token }}` |
| **Execution Mode** | `mode` | `REVIEWGROUND_MODE`, `MODE` | `all` (`review` \| `summary` \| `all`) |
| **Preferred Provider** | `provider` | `REVIEWGROUND_PROVIDER`, `PROVIDER`, `LLM_PROVIDER` | *Auto-detected* |
| **Model Override** | `model` | `REVIEWGROUND_MODEL`, `MODEL`, `LLM_MODEL` | *Provider default* |
| **Gemini API Key** | `gemini-api-key` | `GEMINI_API_KEY`, `GOOGLE_API_KEY` | — |
| **OpenAI API Key** | `openai-api-key` | `OPENAI_API_KEY` | — |
| **Anthropic API Key**| `anthropic-api-key` | `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY` | — |
| **Groq API Key** | `groq-api-key` | `GROQ_API_KEY` | — |
| **DeepSeek API Key** | `deepseek-api-key` | `DEEPSEEK_API_KEY` | — |
| **Custom Base URL** | `llm-base-url` | `LLM_BASE_URL`, `OPENAI_BASE_URL` | — |
| **Custom API Key** | `llm-api-key` | `LLM_API_KEY` | — |
| **Search Grounding** | `enable-search-grounding`| `ENABLE_SEARCH_GROUNDING` | `true` |
| **Inline Suggestions**| `enable-inline-suggestions`| `ENABLE_INLINE_SUGGESTIONS`| `true` |
| **NPM Verification** | `enable-npm-verify` | `ENABLE_NPM_VERIFY` | `true` |
| **Base Branch** | `base-branch` | `REVIEWGROUND_BASE_BRANCH`, `BASE_BRANCH` | `main` |
| **Comment Tag** | `comment-tag` | `REVIEWGROUND_COMMENT_TAG`, `COMMENT_TAG` | `<!-- reviewground-code-review -->` |

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
