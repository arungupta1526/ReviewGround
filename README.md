<div align="center">

# 🛡️ ReviewGround

**The Universal, High-Precision AI Code Reviewer & Post-CI Verification Engine for GitHub Actions.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-v1-purple.svg?logo=githubactions)](https://github.com/marketplace/actions/reviewground)
[![Node Runtime](https://img.shields.io/badge/Node-24%20LTS-green.svg?logo=node.js)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-blue.svg?logo=typescript)](package.json)
[![Zod](https://img.shields.io/badge/Zod-4.6.5-3E67B1.svg?logo=zod)](package.json)
[![BYOK Multi-Provider](https://img.shields.io/badge/BYOK-Gemini%20%7C%20OpenAI%20%7C%20Claude%20%7C%20Groq%20%7C%20DeepSeek%20%7C%20OpenRouter-orange.svg)](#-how-to-get-api-keys--configure-github)
[![Security: 0 Vulnerabilities](https://img.shields.io/badge/Security-0%20Vulnerabilities-success.svg)](package.json)

*Stop paying $50/seat/month for proprietary AI code review bots.*  
**ReviewGround** brings enterprise-grade AI code review, multi-ecosystem registry grounding, interactive PR slash commands, OWASP/CWE security taxonomy tagging, 1-click commit suggestions, and sticky CI summaries directly to your repository with your own API keys.

<br/>

<details>
<summary><b>📸 Click to View Live PR Code Review & CI Summary Screenshots</b></summary>
<br/>

<p align="center">
  <b>1. Sticky PR Comment: ReviewGround AI Code Review & Post-CI Pipeline Verification</b><br/>
  <img src="./images/pr-sticky-review-comment.png" alt="ReviewGround Sticky PR Review Comment" width="850" />
</p>

<p align="center">
  <b>2. PR Description Auto-Update: 🟢 Risk Level Badge & Summary</b><br/>
  <img src="./images/pr-description-risk-badge.png" alt="ReviewGround PR Description Auto-Update" width="850" />
</p>

<p align="center">
  <b>3. Single Sticky Comment Pattern (In-Place PATCH History)</b><br/>
  <img src="./images/pr-sticky-patch-history.png" alt="ReviewGround Single Sticky Comment History" width="850" />
</p>

<p align="center">
  <b>4. Native 1-Click Code Suggestions on PR Diff (GitHub Files Changed Tab)</b><br/>
  <img src="./images/pr-1-click-code-suggestion.png" alt="ReviewGround 1-Click Code Suggestion in GitHub PR Diff" width="850" />
</p>

</details>

---

</div>

## 🌟 Why ReviewGround?

| Feature | Standard AI Review Bots | ReviewGround |
|---|:---:|:---:|
| **Pricing** | $20–$60 / developer / month | **100% Free & Open-Core (BYOK)** |
| **Provider Freedom** | Locked into single proprietary vendor | **Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, Ollama** |
| **Model Customization** | Fixed models only | **Full Custom Model Override (`model: '...'`)** |
| **Multi-Host Safety** | Hijacks open models to hardcoded hosts | **Preserves Custom & OpenRouter host selections (Qwen, Llama)** |
| **Zero-Commit Control** | Must edit YAML & commit for model changes | **Change Provider/Model via GitHub Repo Variables** |
| **Package Hallucinations** | None (flags modern packages as non-existent) | **Multi-Ecosystem Live Registry Grounding (NPM + PyPI + Crates + Go)** |
| **Commit Suggestions** | Markdown text diff blocks | **Native GitHub 1-Click `[ Apply suggestion ]` Buttons** |
| **Interactive PR Commands** | Not supported | **`@reviewground explain/fix`, `/review security` Slash Commands** |
| **Security Taxonomy** | Generic "could be vulnerable" | **OWASP Top 10 + CWE-ID Tagged Findings** |
| **Large PR Handling** | Truncates randomly | **Priority-Based Diff Packing (P0: Auth/API/DB first)** |
| **Test Coverage** | Not supported | **Auto-detects uncovered exports + suggests test stubs** |
| **Cost Transparency** | Hidden / opaque | **Token count & estimated cost footer per review** |
| **PR Comment Noise** | Spams 5–10 new comments per PR push | **Single In-Place Sticky Comment (Updated via PATCH)** |
| **CI Duration Tracking** | Not supported | **Workflow Jobs API Duration Metrics (`9s`, `1m 24s`)** |
| **Local / Air-Gapped AI** | Not supported | **Self-hosted Ollama / Together AI / vLLM compatible** |

---

## 🔑 How to Get API Keys & Configure GitHub

You bring your own API key(s) from any provider you prefer. ReviewGround supports multiple keys with automatic failover!

### 1. Direct Links to Get Your API Keys

| Provider | Recommended Baseline | Free Tier Available? | Get Your API Key (Direct Link) |
|---|---|:---:|---|
| **Google Gemini** | `gemini-3.5-flash-lite` | ✅ **Yes** | 🔗 [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Groq LPU** | `qwen/qwen3.8-27b` | ✅ **Yes** | 🔗 [Groq Console](https://console.groq.com/keys) |
| **OpenRouter** | `qwen/qwen-2.5-coder-32b-instruct` | ✅ **Yes (15+ free models)** | 🔗 [OpenRouter Keys](https://openrouter.ai/keys) |
| **OpenAI** | `gpt-4o-mini` | Paid / Credits | 🔗 [OpenAI Platform](https://platform.openai.com/api-keys) |
| **Anthropic Claude** | `claude-3-5-haiku` | Paid / Credits | 🔗 [Anthropic Console](https://console.anthropic.com/settings/keys) |
| **DeepSeek** | `deepseek-chat` | Paid (Low Cost) | 🔗 [DeepSeek Platform](https://platform.deepseek.com/api_keys) |
| **Custom / Ollama** | Any local model | Free (Self-Hosted) | `http://localhost:11434/v1` |

---

### 2. How to Add API Keys & Settings in Your GitHub Repository

You **never** need to commit API keys to your code. Manage them securely in GitHub:

#### Step A: Store API Keys in GitHub Secrets
1. In your GitHub repository, click **Settings** (top tab).
2. In the left navigation menu, navigate to **Secrets and variables** → **Actions**.
3. Under the **Repository secrets** section, click **New repository secret**.
4. You can name your secret using any of the recognized aliases (ReviewGround auto-detects all of them):

| Provider | Primary Secret Name | Supported Alternate Aliases | Free Tier? |
|---|---|---|:---:|
| **Google Gemini** | `GEMINI_API_KEY` | `GOOGLE_API_KEY`, `GEMINI_KEY` | ✅ Yes |
| **Groq LPU** | `GROQ_API_KEY` | `GROQ_KEY` | ✅ Yes |
| **OpenRouter** | `OPENROUTER_API_KEY` | `OPENROUTER_KEY` | ✅ Yes |
| **OpenAI** | `OPENAI_API_KEY` | `OPENAI_KEY` | Paid |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | `CLAUDE_API_KEY`, `ANTHROPIC_KEY`, `CLAUDE_KEY` | Paid |
| **DeepSeek** | `DEEPSEEK_API_KEY` | `DEEPSEEK_KEY` | Paid |
| **Custom / Ollama URL** | `LLM_BASE_URL` | `OPENAI_BASE_URL`, `OLLAMA_BASE_URL`, `OLLAMA_HOST` | Self-Hosted |
| **Custom Endpoint Key** | `LLM_API_KEY` | `CUSTOM_API_KEY` | Optional |

#### Step B: Zero-Commit Model, Provider & Fallback Control (GitHub Variables)
Want to switch models, providers, or fallback chains without editing your `.github/workflows` YAML or creating git commits?
1. In **Settings** → **Secrets and variables** → **Actions**, click the **Variables** tab.
2. Click **New repository variable**:
   - Name: `PROVIDER` → Value: `gemini` (or `openrouter`, `openai`, `anthropic`, `groq`, `deepseek`)
   - Name: `MODEL` → Value: `gemini-3.5-flash-lite` (or `gpt-4o-mini`, `qwen/qwen3.8-27b`)
   - Name: `FALLBACK_MODELS` (or e.g. `GEMINI_FALLBACK_MODELS`, `GROQ_FALLBACK_MODELS`) → Value: `gemini-3.1-flash-lite,gemini-flash-latest`
3. Whenever you want to experiment with a new model or customize fallback chains, simply update the variable value in GitHub settings. **ReviewGround picks it up on the very next PR run automatically!**

---

### 3. Priority Hierarchy & Automatic Fallback Chains (Serial Kram)

#### ❓ Is `provider` or `model` mandatory to configure?
**No, completely optional!** If you only provide your API keys and omit `provider` and `model`, ReviewGround auto-detects your keys and uses the optimal default baseline model.

#### ❓ What happens if you configure ALL API keys? (Default Priority Order)
When multiple keys are provided without a preference, ReviewGround uses this battle-tested priority order. Each provider is armed with **3–4 built-in fallback models**. If any primary model encounters a quota limit (HTTP 429), model retirement, or downtime, ReviewGround seamlessly falls through the chain:

| Priority Rank | Provider | Default Primary Model | Built-In Fallback Chain (3–4 Models) | Key Strength |
|:---:|---|---|---|---|
| **#1 (Default)** | **Google Gemini** | `gemini-3.5-flash-lite` | `gemini-3.1-flash-lite` ➔ `gemini-flash-latest` ➔ `gemini-flash-lite-latest` ➔ `gemini-3-flash-preview` | Live Google Search Tool Grounding |
| **#2** | **OpenAI** | `gpt-4o-mini` | `gpt-4o` ➔ `gpt-4-turbo` ➔ `gpt-3.5-turbo` | Precision DevSecOps & code analysis |
| **#3** | **Anthropic Claude** | `claude-3-5-haiku` | `claude-3-5-sonnet` ➔ `claude-3-haiku` ➔ `claude-3-sonnet` | Deep reasoning & architectural insight |
| **#4** | **Groq LPU** | `qwen/qwen3.8-27b` | `openai/gpt-oss-120b` ➔ `openai/gpt-oss-20b` ➔ `allam-2-7b` ➔ `llama-3.3-70b-versatile` | Ultra-fast LPU inference (under 1s) |
| **#5** | **DeepSeek** | `deepseek-chat` | `deepseek-reasoner` (R1) | Cost-effective reasoning & logic |
| **#6** | **OpenRouter** | `qwen/qwen-2.5-coder-32b-instruct` | `meta-llama/llama-3.3-70b-instruct` ➔ `mistralai/mistral-small-24b` ➔ `google/gemini-2.0-flash-exp:free` ➔ `liquid/lfm-2.5-2.6b:free` | 200+ models with dedicated routing |
| **#7** | **Custom / Ollama** | `llama3.2` | User-defined | Self-hosted & air-gapped endpoints |

#### 🎯 Can users define their own custom fallback models?
**Yes!** If you want fallback to strictly occur across your chosen models instead of defaults:
- Set via GitHub Repository Variable: `FALLBACK_MODELS="gemini-3.1-flash-lite,gemini-flash-latest"` (or provider-specific: `GEMINI_FALLBACK_MODELS`, `GROQ_FALLBACK_MODELS`, `OPENAI_FALLBACK_MODELS`, `ANTHROPIC_FALLBACK_MODELS`, `DEEPSEEK_FALLBACK_MODELS`, `OPENROUTER_FALLBACK_MODELS`).
- Or pass via Action Input: `fallback-models: "gemini-3.1-flash-lite,gemini-flash-latest"`.
- When set, ReviewGround **strictly restricts fallbacks to your specified models**, guaranteeing that only models you approved will ever run.

#### ❓ What if a model like Qwen or Llama is hosted on another third-party provider?
ReviewGround features **Third-Party Host Preservation**:
- If you specify `provider: 'openrouter'` or `provider: 'custom'` (pointing to Together AI, Fireworks, or Ollama), ReviewGround **NEVER hijacks or reroutes your Qwen or Llama model to Groq**. It executes strictly against your specified provider.
- Models with organization namespaces (e.g. `qwen/qwen-2.5-coder-32b-instruct`, `meta-llama/llama-3.3-70b-instruct`) are correctly recognized as OpenRouter/Multi-host models.

#### ❓ What happens if you specify a mismatched Provider and Model (e.g. Provider = Google, Model = DeepSeek)?
ReviewGround features **Smart Mismatch Auto-Routing**:
- If `provider: 'gemini'` and `model: 'deepseek-chat'` are passed:
  1. ReviewGround inspects the model prefix and detects that `deepseek-chat` belongs to DeepSeek.
  2. If `DEEPSEEK_API_KEY` is present, it **automatically routes the request to DeepSeek** to prevent an invalid model API error!
  3. If DeepSeek is not configured, Gemini will attempt it, catch the invalid model response, and **automatically fall back to `gemini-3.5-flash-lite`** without failing your CI pipeline!

---

## ⚡ Execution Modes (`mode`)

ReviewGround operates in five execution modes configured via the `mode` input (`mode: review | summary | all | describe | slash-command`):

| Mode | Intended Use | Behavior |
|---|---|---|
| **`mode: review`** *(Recommended for Code Review)* | **AI Code Review Only** | Runs universal multi-provider AI review, live multi-registry grounding, smart diff prioritization, OWASP tagging, and 1-click interactive diff suggestions. **Post-CI verification table is completely suppressed.** |
| **`mode: describe`** | **PR Description & Walkthrough** | Analyzes the diff to auto-generate a comprehensive PR summary, key changes bullets, an interactive file walkthrough table, and testing checklist directly into the PR body. |
| **`mode: slash-command`** | **Interactive PR Chat** | Handles `issue_comment` triggers for commands like `@reviewground explain`, `@reviewground fix`, and `/review full/security`. |
| **`mode: summary`** | **Post-CI Verification Only** | Queries GitHub Actions Workflow Jobs API to render duration metrics (`14s`, `1m 20s`) and status badges for Gitleaks, Dependency Audit, Build, Unit Tests, and custom stages. |
| **`mode: all`** *(Default)* | **Unified Review & CI Verification** | Runs AI review first, then appends the CI verification summary to the single sticky comment. Features **Smart CI Auto-Skip**: If no CI stages (`gitleaks-result`, `build-result`, etc.) or matching workflow jobs are detected, the CI table is **automatically omitted** to prevent noisy `unknown` status rows. |

---

## 🚀 Quickstart Workflows

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
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: review
        env:
          # API Keys (Stored in Repository Secrets)
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          # Zero-Commit Dynamic Controls (Configured in Repository Variables)
          PROVIDER: ${{ vars.PROVIDER || '' }}
          MODEL: ${{ vars.MODEL || '' }}
```

---

### Option 2: Minimal Gemini Setup (Free Tier & Search Grounded)

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
          mode: review
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

### Option 3: OpenRouter Setup (Access to 200+ Models)

```yaml
name: ReviewGround OpenRouter Review

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
          mode: review
          model: 'qwen/qwen-2.5-coder-32b-instruct' # Or any model on OpenRouter!
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

---

### Option 4: Local / Self-Hosted LLM (Ollama or Together AI)

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
          mode: review
          provider: 'custom'
          model: 'llama3.2'
        env:
          LLM_BASE_URL: 'http://localhost:11434/v1' # Or https://api.together.xyz/v1
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
```

---

### Option 5: Full End-to-End CI Pipeline with Verification Summary (`mode: all`)

Combine AI code review with automated stage verification in a multi-job workflow:

```yaml
name: CI Pipeline & AI Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: read

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Secret Scan
        run: echo "Gitleaks scan complete"

  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci && npm test && npm run build

  reviewground:
    needs: [gitleaks, build-and-test]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: arungupta1526/ReviewGround@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: all
          gitleaks-result: ${{ needs.gitleaks.result }}
          build-result: ${{ needs.build-and-test.result }}
          test-result: ${{ needs.build-and-test.result }}
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

---

### Option 6: Complete Exhaustive Configuration (All Inputs with Defaults & Comments)

For enterprise teams and advanced workflows, here is a complete reference configuration showcasing every single available input, its default value, and descriptive comments:

```yaml
name: ReviewGround Full Enterprise Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  actions: read
  checks: write               # Required if enable-check-run is set to 'true'

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0      # Required for git diff calculation

      - uses: arungupta1526/ReviewGround@v1
        with:
          # ── Core Execution & Git Controls ────────────────────────────────
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: 'all'                             # 'review' | 'summary' | 'all' | 'describe' | 'slash-command'
          base-branch: 'main'                     # Target branch for diff (default: 'main')

          # ── AI Review Depth & Customization ──────────────────────────────
          review-level: 'standard'               # 'critical' | 'standard' (default) | 'comprehensive'
          review-language: 'en'                  # BCP-47 language code e.g. 'en', 'ja', 'es', 'de', 'zh'
          temperature: '0.2'                     # Sampling temperature 0.0–1.0 (default: '0.2')
          max-tokens: '2048'                     # Max response token length (default: '2048')
          ignore-patterns: ''                    # Comma-separated globs e.g. 'dist/**,*.min.js'

          # ── Grounding & Inline Suggestions (on by default) ───────────────
          enable-inline-suggestions: 'true'      # Native GitHub 1-click [ Apply suggestion ] buttons
          enable-search-grounding: 'true'        # Google Search tool grounding for Gemini
          enable-npm-verify: 'true'              # Live registry.npmjs.org anti-hallucination check

          # ── v1.3.0: Multi-Ecosystem Registry Grounding ───────────────────
          enable-multi-registry-verify: 'true'  # Also verify PyPI, Crates.io & Go module proxy (default: 'true')

          # ── v1.3.0: Token & Cost Transparency Footer ─────────────────────
          enable-cost-footer: 'true'             # Show est. tokens + cost + latency in sticky comment (default: 'true')

          # ── v1.3.0: Smart Diff Priority Scoring for Large PRs ────────────
          enable-smart-diff-priority: 'true'     # P0=auth/API/DB first, P2=assets/locks skipped (default: 'true')

          # ── v1.3.0: OWASP Top 10 & CWE Taxonomy Tagging ─────────────────
          enable-owasp-tagging: 'true'           # Tag security findings with CWE-ID & OWASP category (default: 'true')

          # ── v1.3.0: Missing Unit Test Detection & Stubs ──────────────────
          enable-test-coverage-check: 'true'     # Warn on new exports lacking tests + suggest stubs (default: 'true')

          # ── v1.3.0: Automated PR Description & Walkthrough (Opt-In) ───────
          generate-pr-description: 'false'       # Auto-generate PR summary, walkthrough table & checklist
          enable-pr-description-update: 'false'  # Append 🟢/🟡/🔴 risk badge & walkthrough table to PR body
          enable-check-run: 'false'              # Create blocking pass/fail GitHub Check Run gate

          # ── Multi-Provider Overrides (Optional) ──────────────────────────
          provider: ''                           # Force: 'gemini' | 'groq' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter' | 'custom'
          model: ''                              # Force model override e.g. 'deepseek-chat', 'gpt-4o'
          fallback-models: ''                    # Custom comma-separated failover models

          # ── Post-CI Status Verification (Optional Stage Inputs) ───────────
          gitleaks-result: ''                    # e.g. ${{ needs.gitleaks.result }}
          audit-result: ''                       # e.g. ${{ needs.security-audit.result }}
          build-result: ''                       # e.g. ${{ needs.build.result }}
          test-result: ''                        # e.g. ${{ needs.test.result }}
          extra-stages: ''                       # e.g. '[{"name":"Deploy","result":"success"}]'
        env:
          # ── BYOK Provider API Keys (set any one or multiple in GitHub Secrets) ──
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          LLM_BASE_URL: ${{ secrets.LLM_BASE_URL }}         # Self-hosted endpoint (e.g. Ollama/vLLM)
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}           # API key for custom endpoint
```

---


## 🏗️ End-to-End Architecture & Workflow

```mermaid
flowchart TD
    %% Color Palettes
    classDef trigger fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef config fill:#181825,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4;
    classDef safety fill:#313244,stroke:#f9e2af,stroke-width:2px,color:#f9e2af;
    classDef grounding fill:#11261f,stroke:#a6e3a1,stroke-width:2px,color:#a6e3a1;
    classDef llm fill:#2b1b3d,stroke:#f38ba8,stroke-width:2px,color:#f5c2e7;
    classDef zod fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#e0f2fe;
    classDef output fill:#11261f,stroke:#a6e3a1,stroke-width:2px,color:#a6e3a1;
    classDef summary fill:#261828,stroke:#fab387,stroke-width:2px,color:#fab387;
    classDef newfeature fill:#1f1a00,stroke:#f9e2af,stroke-width:2px,color:#f9e2af;

    subgraph TRIGGER["1. GitHub Event & Context Resolution"]
        PR["PR Event: opened / synchronize / reopened"]:::trigger
        COMMENT_EVT["issue_comment Event<br/>@reviewground / /review commands"]:::trigger
        BOT{"Is PR from Automated Bot?<br/>(e.g. dependabot[bot])"}:::safety
        SKIP["Graceful Skip (Preserves CI Build Green)"]:::safety
    end

    subgraph SLASH["1b. Slash Command Handler (mode: slash-command)"]
        PARSE_CMD["Parse Command from Comment Body<br/>@reviewground explain, fix / /review on-demand"]:::newfeature
        CMD_EXPLAIN["AI Explains Flagged Issues<br/>with Educational Context"]:::newfeature
        CMD_FIX["AI Generates Concrete Code Patch"]:::newfeature
        CMD_REVIEW["On-Demand Focused Re-Review<br/>full, security, performance, standard"]:::newfeature
    end

    subgraph DESCRIBE["1c. PR Description & Walkthrough (mode: describe)"]
        DIFF_DESC["Extract PR Diff for Walkthrough"]:::config
        GEN_WALKTHROUGH["AI Generates Walkthrough Table, Summary,<br/>Key Changes, Testing Checklist & Risk Badge"]:::newfeature
        MERGE_BODY["Smart Body Merge<br/>Preserves Author Notes & Updates PR Body"]:::output
    end

    subgraph CONFIG["2. Dynamic Config & Context Ingestion"]
        PARSE["Parse Inputs & Repository Variables<br/>(vars.PROVIDER, vars.MODEL, vars.FALLBACK_MODELS)"]:::config
        RULES["Load Custom Repo Guidelines<br/>(.reviewground.yml)"]:::config
        DETECT{"Auto-Detect Provider Priority<br/>Gemini → OpenAI → Claude → Groq → DeepSeek → OpenRouter → Custom"}:::config
        KEYS_CHECK{"Any LLM Key Configured?<br/>(Secrets or Env)"}:::safety
        SETUP_NOTICE["Post Interactive Missing Key Setup Guide<br/>(1-Minute Setup Banner + Free Key Links)"]:::output
    end

    subgraph ENGINE["3. Grounding & Multi-Provider AI Review Engine"]
        DIFF["Extract PR Diff (GitHub API / git diff)"]:::config
        PRIORITY["Smart Diff Prioritizer<br/>P0=auth/API/DB first, P1=standard, P2=assets/locks skip"]:::newfeature
        REGISTRY["Multi-Ecosystem Registry Grounding<br/>NPM + PyPI + Crates.io + Go module proxy"]:::grounding
        SEARCH["Google Search Tool Grounding (Gemini)<br/>Live Web Context Injection"]:::grounding
        OWASP["OWASP Top 10 + CWE Taxonomy Injection<br/>Forces CWE-ID & OWASP category on security findings"]:::newfeature
        PROMPT["Assemble Grounded Prompt + System Guardrails<br/>(Provider Format: XML/Schema/Markdown + Language)"]:::grounding
        RETRY["fetchWithRetry (Backoff + Jitter)"]:::llm
        CALL_PRIMARY["Call Primary Model<br/>(e.g. gemini-3.5-flash-lite / qwen3.8-27b)"]:::llm
        FALLBACK_CHECK{"Primary Succeeded or HTTP 429 / Quota Error?"}:::llm
        CALL_FALLBACK["Sequential Fallback Chain<br/>(Custom FALLBACK_MODELS or 3-4 Built-In Models)"]:::llm
        DIAGNOSTIC_NOTICE["Post Diagnostic Failure Notice<br/>(Links to Actions Run Logs)"]:::safety
        ZOD["Zod 4.6.5 Validation & Line Number Coercion<br/>(InlineSuggestionsListSchema)"]:::zod
    end

    subgraph POSTPROC["4. Post-Processing & Enrichment"]
        TEST_CHECK["Missing Test Coverage Detector<br/>Flags uncovered exports + suggests stubs (TS/JS/Py/Go)"]:::newfeature
        COST_FOOTER["Token & Cost Transparency Footer<br/>Model • Est. Tokens • Est. USD Cost • Latency"]:::newfeature
    end

    subgraph GATES["5. Multi-Channel Outputs & Merge Gates"]
        COMMENT_INLINE["PR Diff Review Comments API<br/>1-Click 'Apply suggestion' In Diff"]:::output
        CHECK_RUN["GitHub Check Run (Pass/Fail Gate)<br/>Blocks Merge on Critical Vulnerabilities"]:::output
        PR_DESC["Auto-Update PR Description<br/>Injects Walkthrough Table & Risk Badge"]:::output
        COMMENT_REPLY["PR Comment Reply API<br/>Direct Conversational Response"]:::output
    end

    subgraph SUMMARY_FLOW["6. Post-CI Pipeline Sticky Summary & Dynamic Job Discovery"]
        CI_CHECK{"Any CI Data or Jobs Detected?<br/>hasCiData()"}:::summary
        SKIP_CI["Smart Auto-Skip Empty CI Table<br/>(Keeps PR Comments Clean)"]:::safety
        JOB_API["Dynamic Job Auto-Discovery<br/>(Query GitHub API: /actions/runs/{run_id}/jobs)"]:::summary
        DURATIONS["Calculate Real Stage Durations + Extra Stages<br/>(Gitleaks, Audit, Build, Test, Deploy...)"]:::summary
        STICKY_FIND{"Previous Review Sticky Comment Found?<br/>(&lt;!-- reviewground-code-review --&gt;)"}:::summary
        UPDATE["PATCH Existing Comment (In-Place Update)"]:::output
        CREATE["POST New Sticky Comment"]:::output
    end

    %% Trigger routing
    PR --> BOT
    COMMENT_EVT --> PARSE_CMD
    PARSE_CMD --> CMD_EXPLAIN & CMD_FIX
    PARSE_CMD --> CMD_REVIEW
    CMD_EXPLAIN & CMD_FIX --> COMMENT_REPLY
    CMD_REVIEW --> STICKY_FIND
    BOT -- "Yes" --> SKIP
    BOT -- "No" --> PARSE
    PARSE --> RULES
    RULES --> DETECT
    DETECT -- "mode: describe" --> DIFF_DESC
    DIFF_DESC --> GEN_WALKTHROUGH
    GEN_WALKTHROUGH --> MERGE_BODY
    DETECT --> KEYS_CHECK
    KEYS_CHECK -- "No Keys" --> SETUP_NOTICE
    KEYS_CHECK -- "Keys Found" --> DIFF
    DIFF --> PRIORITY
    PRIORITY --> REGISTRY
    REGISTRY --> SEARCH
    SEARCH --> OWASP
    OWASP --> PROMPT
    PROMPT --> CALL_PRIMARY
    CALL_PRIMARY --> RETRY
    RETRY --> FALLBACK_CHECK
    FALLBACK_CHECK -- "Failed / 429" --> CALL_FALLBACK
    FALLBACK_CHECK -- "Success" --> ZOD
    CALL_FALLBACK -- "All Failed" --> DIAGNOSTIC_NOTICE
    CALL_FALLBACK -- "Fallback Succeeded" --> ZOD
    ZOD --> TEST_CHECK
    TEST_CHECK --> COST_FOOTER
    COST_FOOTER --> STICKY_FIND
    COST_FOOTER --> COMMENT_INLINE & CHECK_RUN
    COST_FOOTER -. "generate-pr-description: true" .-> PR_DESC
    PR_DESC --> MERGE_BODY

    %% CI Summary Flow
    DETECT -. "mode: summary or all" .-> CI_CHECK
    CI_CHECK -- "No CI Data" --> SKIP_CI
    CI_CHECK -- "Jobs / Stages Present" --> JOB_API
    JOB_API --> DURATIONS
    DURATIONS --> STICKY_FIND
    STICKY_FIND -- "Found" --> UPDATE
    STICKY_FIND -- "Not Found" --> CREATE
```

<p align="center">
  <em>High-resolution architecture renders available in <a href="./images/architecture-diagram.svg">SVG format</a> and <a href="./images/architecture-diagram.png">PNG format</a>.</em>
</p>

---

## 📂 Repository & Modular Architecture

ReviewGround is architected around domain-driven, single-responsibility modules adhering to strict file-size limits (<350 lines per module):

```text
reviewground/
├── .github/
│   ├── workflows/             # CI testing & Release Please release automation
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml
├── images/                    # Visual assets & architecture diagrams (.mmd, .svg, .png)
│   ├── architecture-diagram.mmd
│   ├── architecture-diagram.svg
│   ├── architecture-diagram.png
│   ├── pr-1-click-code-suggestion.png
│   ├── pr-description-risk-badge.png
│   ├── pr-sticky-patch-history.png
│   └── pr-sticky-review-comment.png
├── src/
│   ├── github/                # 🐙 GitHub REST API integration
│   │   ├── checks.ts          # GitHub Check Run gates & PR description updates
│   │   ├── comments.ts        # Diff fetching, inline suggestions & comment management
│   │   ├── stickyComment.ts   # In-place sticky comment update lifecycle
│   │   ├── workflowJobs.ts    # GitHub Actions API workflow run & stage duration tracking
│   │   └── index.ts
│   ├── metrics/               # ⚡ Cost, latency & token usage calculations
│   │   ├── costEstimator.ts   # Model-aware pricing & cost transparency footer
│   │   └── index.ts
│   ├── prompts/               # 🧠 Prompt engineering & guideline loaders
│   │   ├── reviewPrompt.ts    # Provider-optimized prompts (XML/JSON/Markdown) & OWASP injection
│   │   └── index.ts
│   ├── providers/             # 🔌 BYOK Multi-Provider Engine (Native fetch adapters)
│   │   ├── anthropic.ts       # Anthropic Claude 3.5 Haiku/Sonnet adapter
│   │   ├── custom.ts          # OpenAI-compatible custom endpoints (vLLM, Ollama)
│   │   ├── deepseek.ts        # DeepSeek V3 / R1 reasoning adapter
│   │   ├── gemini.ts          # Google Gemini adapter with Google Search grounding
│   │   ├── groq.ts            # Groq ultra-fast LPU inference adapter
│   │   ├── openai.ts          # OpenAI GPT-4o / GPT-4o-mini adapter
│   │   ├── openrouter.ts      # OpenRouter aggregator adapter
│   │   ├── types.ts           # Provider interfaces & response contracts
│   │   └── index.ts           # ProviderManager with auto-detection & fallback chains
│   ├── utils/
│   │   └── fetchWithRetry.ts  # Native exponential backoff with jitter
│   ├── diffPrioritizer.ts     # 🎯 Smart diff prioritization (P0 auth/APIs, P2 locks/assets)
│   ├── packageRegistry.ts     # 📦 Multi-ecosystem real-time registry verification (npm, PyPI, crates, go)
│   ├── prDescriber.ts         # 📝 PR description & walkthrough table generator
│   ├── reviewer.ts            # 🛡️ Core review orchestrator
│   ├── slashCommands.ts       # 💬 Interactive PR comments dispatcher (@reviewground explain/fix)
│   ├── summary.ts             # 🚦 Post-CI verification summary generator
│   ├── testCoverageDetector.ts# 🧪 Missing unit test detection & stub suggestions
│   └── index.ts               # 🚀 GitHub Action entry point
├── test/                      # 🧪 Unit & invariant test suites (100% passing)
│   ├── features.test.ts       # Tests for registry verification, diff prioritization, test coverage
│   ├── github.test.ts         # Tests for repo sanitization, SSRF protection, token & cost calculation
│   ├── prDescriber.test.ts    # Tests for PR description generation & body merging
│   ├── providers.test.ts      # Tests for multi-provider BYOK routing & fallbacks
│   ├── reviewer.test.ts       # Tests for review engine, inline suggestions & Zod validation
│   └── summary.test.ts        # Tests for CI summary generation, durations & badges
├── action.yml                 # GitHub Action metadata & input definitions (<125 char description)
├── package.json
└── tsconfig.json
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

<p align="center">
  <img src="./images/pr-1-click-code-suggestion.png" alt="ReviewGround 1-Click Code Suggestion in GitHub PR Diff" width="850" />
</p>

All line numbers are validated and safely coerced with **Zod 4.6.5** schemas (`InlineSuggestionsListSchema`), preventing runtime crashes when LLMs return string line numbers.

### 3. 📊 Post-CI Single Sticky PR Summary & Dynamic Job Discovery
ReviewGround detects previous comments using a persistent HTML marker (`<!-- reviewground-code-review -->`) and updates them using `PATCH /repos/{owner}/{repo}/issues/comments/{id}`.  
- New commits update the existing review in-place without comment spam.
- **Dynamic Job Auto-Discovery:** ReviewGround queries the GitHub Actions Workflow Jobs API (`/actions/runs/{run_id}/jobs`) to automatically discover **all workflow jobs** (whether 1, 3, or 10 jobs like Lint, Typecheck, Docker Build, Playwright E2E, Deploy) without forcing hardcoded stages:

| Pipeline Stage / Job | Status | Duration | Verification Logs |
|---|:---:|:---:|---|
| 🧪 **1. Lint & Typecheck** | ✅ Passed | `14s` | [View Logs](https://github.com/owner/repo/actions/runs/123/job/1) |
| 🧪 **2. Docker Container Build** | ✅ Passed | `1m 20s` | [View Logs](https://github.com/owner/repo/actions/runs/123/job/2) |
| 🧪 **3. Playwright E2E Tests** | ✅ Passed | `45s` | [View Logs](https://github.com/owner/repo/actions/runs/123/job/3) |

*(Note: If you provide explicit 4-stage inputs like `gitleaks-result` or `build-result`, ReviewGround will render them according to your custom inputs).*

---

## 🛠️ Complete Configuration Reference

### Action Inputs & Environment Variables

Every setting can be passed either as an Action Input (`with:`) or as an Environment Variable / Secret (`env:`):

| Setting | Action Input (`with:`) | Environment Variable & Secret Aliases (`env:` / `vars.*`) | Default |
|---|---|---|:---:|
| **GitHub Token** | `github-token` | `GITHUB_TOKEN`, `GH_TOKEN` | `${{ github.token }}` |
| **Execution Mode** | `mode` | `REVIEWGROUND_MODE`, `MODE` | `all` (`review` \| `summary` \| `all` \| `describe` \| `slash-command`) |
| **Preferred Provider** | `provider` | `REVIEWGROUND_PROVIDER`, `PROVIDER`, `LLM_PROVIDER` | *Auto-detected* |
| **Model Override** | `model` | `REVIEWGROUND_MODEL`, `MODEL`, `LLM_MODEL` | *Provider default* |
| **Fallback Models** | `fallback-models` | `FALLBACK_MODELS`, `<PROVIDER>_FALLBACK_MODELS` | *Built-in 3–4 models* |
| **Gemini API Key** | `gemini-api-key` | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_KEY` | — |
| **Groq API Key** | `groq-api-key` | `GROQ_API_KEY`, `GROQ_KEY` | — |
| **OpenRouter API Key**| `openrouter-api-key`| `OPENROUTER_API_KEY`, `OPENROUTER_KEY` | — |
| **OpenAI API Key** | `openai-api-key` | `OPENAI_API_KEY`, `OPENAI_KEY` | — |
| **Anthropic API Key**| `anthropic-api-key` | `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`, `ANTHROPIC_KEY`, `CLAUDE_KEY` | — |
| **DeepSeek API Key** | `deepseek-api-key` | `DEEPSEEK_API_KEY`, `DEEPSEEK_KEY` | — |
| **Custom Base URL** | `llm-base-url` | `LLM_BASE_URL`, `OPENAI_BASE_URL`, `OLLAMA_BASE_URL`, `OLLAMA_HOST` | — |
| **Custom API Key** | `llm-api-key` | `LLM_API_KEY`, `CUSTOM_API_KEY` | — |
| **Search Grounding** | `enable-search-grounding`| `ENABLE_SEARCH_GROUNDING` | `true` |
| **Inline Suggestions**| `enable-inline-suggestions`| `ENABLE_INLINE_SUGGESTIONS`| `true` |
| **NPM Verification** | `enable-npm-verify` | `ENABLE_NPM_VERIFY` | `true` |
| **Multi-Registry Verify** | `enable-multi-registry-verify` | `ENABLE_MULTI_REGISTRY_VERIFY` | `true` — also verifies PyPI, Crates.io & Go module proxy |
| **Cost Footer** | `enable-cost-footer` | `ENABLE_COST_FOOTER` | `true` — shows token count + estimated cost in sticky comment |
| **Smart Diff Priority** | `enable-smart-diff-priority` | `ENABLE_SMART_DIFF_PRIORITY` | `true` — P0 (auth/API/DB), P1 (standard), P2 (assets/locks) |
| **OWASP Tagging** | `enable-owasp-tagging` | `ENABLE_OWASP_TAGGING` | `true` — tags security findings with CWE-ID & OWASP category |
| **Test Coverage Check** | `enable-test-coverage-check` | `ENABLE_TEST_COVERAGE_CHECK` | `true` — warns when new exports lack unit tests + suggests stubs |
| **Base Branch** | `base-branch` | `REVIEWGROUND_BASE_BRANCH`, `BASE_BRANCH` | `main` |
| **LLM Temperature** | `temperature` | `REVIEWGROUND_TEMPERATURE`, `LLM_TEMPERATURE` | `0.2` |
| **Max Tokens** | `max-tokens` | `REVIEWGROUND_MAX_TOKENS`, `LLM_MAX_TOKENS` | `2048` |
| **Review Level** | `review-level` | `REVIEWGROUND_REVIEW_LEVEL`, `REVIEW_LEVEL` | `standard` (`critical` \| `standard` \| `comprehensive`) |
| **Ignore Patterns** | `ignore-patterns` | `REVIEWGROUND_IGNORE_PATTERNS`, `IGNORE_PATTERNS` | — (comma-separated globs e.g. `dist/**,*.min.js`) |
| **Review Language** | `review-language` | `REVIEWGROUND_REVIEW_LANGUAGE`, `REVIEW_LANGUAGE` | `en` (e.g. `ja`, `es`, `de`, `zh`, `pt`, `fr`) |
| **Generate PR Description** | `generate-pr-description` | `GENERATE_PR_DESCRIPTION`, `REVIEWGROUND_GENERATE_PR_DESCRIPTION` | `false` — auto-generates PR summary, walkthrough table & checklist |
| **PR Description Update** | `enable-pr-description-update` | `ENABLE_PR_DESCRIPTION_UPDATE` | `false` — auto-appends 🟢/🟡/🔴 risk badge to PR body |
| **GitHub Check Run** | `enable-check-run` | `ENABLE_CHECK_RUN` | `false` — creates pass/fail Check Run (requires `checks: write`) |
| **Extra CI Stages** | `extra-stages` | `REVIEWGROUND_EXTRA_STAGES`, `EXTRA_STAGES` | — JSON array e.g. `[{"name":"Deploy","result":"success"}]` |
| **Comment Tag** | `comment-tag` | `REVIEWGROUND_COMMENT_TAG`, `COMMENT_TAG` | `<!-- reviewground-code-review -->` |


### Action Outputs

| Output | Description |
|---|---|
| `reviewed` | `"true"` if an AI review was successfully generated |
| `reviewer-engine` | The provider and model that generated the review (e.g. `Google Gemini (gemini-3.5-flash-lite)`) |
| `described` | `"true"` if an automated PR description and walkthrough was generated |
| `summarized` | `"true"` if the CI pipeline summary was rendered |
| `summary-markdown`| The rendered markdown table of the CI summary and stage durations |

---

## ⚡ v1.3.0 — Competitive Feature Suite

### 💬 Feature 1: Interactive PR Slash Commands (`issue_comment` trigger)

Add a separate workflow step to handle `@reviewground` commands and `/review` slash commands posted by developers in PR comments:

```yaml
# .github/workflows/reviewground-slash.yml
name: ReviewGround Slash Commands
on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write

jobs:
  slash-command:
    runs-on: ubuntu-latest
    if: github.event.issue.pull_request != null  # Only handle PR comments
    steps:
      - uses: arungupta1526/ReviewGround@v1
        with:
          mode: 'slash-command'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}  # or any other provider
```

**Supported commands** (post in any PR comment):

| Command | Description |
|---|---|
| `@reviewground explain` | AI explains why flagged issues were raised, with context |
| `@reviewground fix` | AI suggests a concrete code patch for detected issues |
| `/review full` | Triggers a full comprehensive re-review (all levels) |
| `/review security` | Security-focused re-review (OWASP only) |
| `/review performance` | Performance-focused re-review |
| `/review` or `/review standard` | Standard re-review |

---

### 📝 Feature 2: Automated PR Description & Walkthrough Generator (`mode: describe`)

Stop wasting time writing manual PR descriptions. ReviewGround inspects your diff and automatically generates a clean **Summary of Changes**, **Key Changes bullets**, an interactive **Walkthrough Table**, and a **Testing Checklist** directly in your PR body:

```yaml
# Standalone mode: generate description on PR open or synchronize
- uses: arungupta1526/ReviewGround@v1
  with:
    mode: 'describe'
    github-token: ${{ secrets.GITHUB_TOKEN }}
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

Or enable it alongside your code review:

```yaml
- uses: arungupta1526/ReviewGround@v1
  with:
    generate-pr-description: 'true'
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

**What it generates in the PR body:**

```markdown
### 📝 Summary of Changes
Added JWT token rotation and secure session invalidation to resolve security audit findings.

### 🔑 Key Changes
- Integrated crypto.randomUUID() for cryptographically secure session IDs.
- Added expiry validation and automatic refresh token rotation handler.

### 🔍 Changes Walkthrough
| File | Summary of Changes |
|---|---|
| `src/auth/jwt.ts` | Implemented token rotation logic and expiry checks |
| `src/api/routes.ts` | Added `/auth/refresh` endpoint with rate limiting |
| `src/db/sessions.ts` | Added session cleanup query on logout |

### 🧪 Testing Checklist
- [ ] Unit tests added / updated
- [ ] Manual verification completed
- [ ] No regressions in core workflows

### 🛡️ Risk Assessment
- 🟢 **Risk Level: LOW** — Non-breaking security enhancement with 100% test coverage.
```

> **Author Preservation:** If the PR author already wrote notes or referenced issue numbers (e.g. `Fixes #42`), ReviewGround preserves the author's original text and cleanly appends the AI Walkthrough below!

---

### 🌐 Feature 3: Multi-Ecosystem Registry Grounding

ReviewGround now auto-detects and verifies packages across all major ecosystems:

| Ecosystem | File Detected | Registry API |
|---|---|---|
| **JavaScript/Node** | `package.json` | `registry.npmjs.org` |
| **Python** | `requirements.txt`, `pyproject.toml` | `pypi.org/pypi/{pkg}/json` |
| **Rust** | `Cargo.toml` | `crates.io/api/v1/crates/{pkg}` |
| **Go** | `go.mod` | `proxy.golang.org` |

Enable/disable: `enable-multi-registry-verify: 'true'` (default on).

---

### 🪙 Feature 4: Token & Cost Transparency Footer

Every sticky review comment now includes a transparency stat bar at the bottom:

```
⚡ ReviewGround | Model: `gemini-3.5-flash-lite` | Est. Tokens: 1,840 | Est. Cost: ~$0.0002 | Latency: 1.2s
Saved ~$20–50/mo vs proprietary AI review bots
```

Enable/disable: `enable-cost-footer: 'true'` (default on).

---

### 🎯 Feature 5: Smart Diff Prioritization for Large PRs

For PRs >28,000 characters, ReviewGround prioritizes files based on security impact:

| Tier | Files | Behavior |
|---|---|---|
| **P0 (Critical)** | `auth/`, `api/`, `db/`, `payments/`, `*.sql`, middleware, config | Always reviewed first |
| **P1 (Standard)** | Regular application code | Reviewed if budget allows |
| **P2 (Skip first)** | `package-lock.json`, `*.snap`, `dist/`, SVG/images, vendor | Skipped first when budget tight |

Enable/disable: `enable-smart-diff-priority: 'true'` (default on).

---

### 🏷️ Feature 6: OWASP Top 10 & CWE Taxonomy Tagging

When security issues are flagged, ReviewGround now instructs the AI to include standard vulnerability IDs:

- ❌ **CWE-89: SQL Injection** (OWASP A03:2021 — Injection)
- ⚠️ **CWE-79: Cross-Site Scripting (XSS)** (OWASP A03:2021)
- 🔒 **CWE-798: Hardcoded Credentials** (OWASP A07:2021)
- 🌐 **CWE-918: SSRF** (OWASP A10:2021)

Enable/disable: `enable-owasp-tagging: 'true'` (default on).

---

### 🧪 Feature 7: Missing Unit Test Warning & Auto-Test Stubs

ReviewGround detects new exported functions, classes, and HTTP endpoints added in a PR without corresponding test files being updated:

```
⚠️ 2 new exported functions detected without corresponding unit tests: `generateToken`, `validateSession`

<details>
<summary>🧪 Click to view suggested unit test stubs</summary>

```typescript
// src/auth/jwt.ts → generateToken
it('generateToken — should work correctly', () => {
  const result = generateToken();
  expect(result).toBeDefined();
});
```

</details>
```

Supported languages: **TypeScript, JavaScript, Python, Go**.  
Enable/disable: `enable-test-coverage-check: 'true'` (default on).

---

## 📋 Custom Repository Guidelines (`.reviewground.yml`)

Add a `.reviewground.yml` (or `.github/reviewground.yml`) file to your repository root to enforce team-specific coding rules:

```yaml
# .reviewground.yml
rules:
  - "Prefer early returns and guard clauses over deep nesting."
  - "Every exported function in src/ must include JSDoc comments."
  - "Always use crypto.randomUUID() instead of third-party uuid packages."
  - "All database queries must use parameterized statements."
```

ReviewGround automatically detects this file and injects your repository rules directly into the AI prompt!

---

## 🛡️ Enterprise Workflow Features

### 1. GitHub Check Run (PR Merge Gate)
Turn ReviewGround into a mandatory status check in your branch protection rules. When enabled, it creates a native GitHub Check Run that **fails** if critical security vulnerabilities, injection flaws, or secret leaks are detected:

```yaml
permissions:
  contents: read
  pull-requests: write
  actions: read
  checks: write    # Required for Check Run gate

steps:
  - uses: arungupta1526/ReviewGround@v1
    with:
      enable-check-run: 'true'
    env:
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### 2. PR Description Auto-Update with Risk Badge
Automatically append a risk level badge (🟢 Low / 🟡 Moderate / 🔴 High Risk) and executive summary below the pull request author's initial description:

```yaml
steps:
  - uses: arungupta1526/ReviewGround@v1
    with:
      enable-pr-description-update: 'true'
    env:
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### 3. Multi-Language Reviews
Receive AI code reviews in your team's preferred language (e.g. Japanese, Spanish, German, French, Chinese, Portuguese):

```yaml
steps:
  - uses: arungupta1526/ReviewGround@v1
    with:
      review-language: 'ja' # 'ja', 'es', 'de', 'zh', 'pt', 'fr', etc.
    env:
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

### 4. Dynamic Extra Stages in CI Summary
Append custom stages (such as deployments, visual regression, or integration suites) to the post-CI summary table:

```yaml
steps:
  - uses: arungupta1526/ReviewGround@v1
    with:
      mode: 'summary'
      extra-stages: '[{"name":"E2E Cypress","result":"success"},{"name":"Staging Deploy","result":"success"}]'
```

### 5. Smart CI Verification Auto-Skip
In `mode: all` (default mode), ReviewGround automatically cross-checks if any CI stage inputs (`gitleaks-result`, `audit-result`, `build-result`, `test-result`, `extra-stages`) or matching workflow jobs were detected:
- If none exist, the Post-CI verification table is **smartly skipped** so your PR comments remain clean and focused solely on code review without noisy `unknown` status rows.
- When CI stages are supplied, ReviewGround appends the complete verification table and duration metrics in the same sticky PR comment.

### 6. Actionable Missing-Key Guidance & Diagnostic Notices
Never guess why an AI review didn't trigger:
- **No Keys Configured**: When a pull request runs without any AI API key in repository secrets, ReviewGround posts an interactive setup banner on the PR with direct links to free keys (Google AI Studio, Groq Console, OpenRouter).
- **Graceful Bot PR Skipping**: Automated bots (e.g. `dependabot[bot]`) are detected and skipped silently without failing CI runs or posting noise.
- **Provider Failure Diagnostics**: If all configured AI providers fail due to quota exhaustion or upstream rate limits, ReviewGround posts a diagnostic notice with direct links to the GitHub Actions run logs.

---

## 🥊 Feature Comparison: ReviewGround vs. Alternatives

| Feature | **ReviewGround** | **CodeRabbit** | **Qodo (CodiumAI)** | **PR-Agent** | **GitHub Copilot** |
|---|:---:|:---:|:---:|:---:|:---:|
| **Pricing Model** | **100% Free (BYOK)** | $24–$30/dev/mo | Usage-based credits | Free (OSS) / BYOK | Bundled ($19–$39/dev/mo) |
| **Provider Freedom** | ✅ **7 Providers + Custom** | ❌ Proprietary Cloud | ❌ Proprietary Cloud | ✅ BYOK (LiteLLM) | ❌ OpenAI Only |
| **Local / Private LLMs** | ✅ Ollama, vLLM, Together | ❌ No | ❌ No | ✅ Supported | ❌ No |
| **1-Click Diff Suggestions** | ✅ Native GitHub | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Interactive Slash Commands** | ✅ **`@explain`/`@fix`/`/review`** | ✅ Yes | ⚠️ Limited | ✅ Yes | ❌ No |
| **Multi-Ecosystem Grounding** | ✅ **NPM + PyPI + Crates + Go** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Google Search Grounding** | ✅ Gemini Live Grounding | ❌ No | ❌ No | ❌ No | ❌ No |
| **OWASP / CWE Taxonomy** | ✅ **Auto-tagged findings** | ⚠️ Generic text | ⚠️ Generic text | ⚠️ Generic text | ⚠️ Generic text |
| **Smart Diff Priority (P0/P1/P2)** | ✅ **Auth/API/DB always first** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Missing Test Detection** | ✅ **Stubs for TS/JS/Py/Go** | ✅ Yes | ✅ Yes | ⚠️ Limited | ❌ No |
| **Cost Transparency Footer** | ✅ **Tokens + USD + Latency** | ❌ Hidden | ❌ Hidden | ❌ Hidden | ❌ Hidden |
| **CI Duration Metrics** | ✅ **Unique** (GitHub Jobs API) | ❌ No | ❌ No | ❌ No | ❌ No |
| **Sticky Summary (No Spam)** | ✅ In-place `PATCH` | ✅ Yes | ✅ Yes | ⚠️ Variable | ✅ Yes |
| **Repository Rules File** | ✅ `.reviewground.yml` | ✅ `.coderabbit.yaml` | ✅ `.qodo.toml` | ✅ `.pr_agent.toml` | ❌ No |
| **GitHub Check Run Gate** | ✅ Native (Pass/Fail) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **PR Description Risk Badge** | ✅ 🟢/🟡/🔴 + Walkthrough | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Beta |
| **Multi-Language Output** | ✅ BCP-47 (`ja`, `es`, `zh`...) | ⚠️ Limited | ⚠️ Limited | ✅ Supported | ⚠️ Limited |
| **Open Source License** | ✅ **AGPL-3.0** | ❌ Proprietary | ❌ Proprietary | ✅ Apache-2.0 | ❌ Proprietary |
| **Runtime Architecture** | ✅ Zero-dependency (<2MB) | ❌ Hosted SaaS Proxy | ❌ Hosted SaaS Proxy | ⚠️ Python CLI / App | ❌ Hosted SaaS |

> [!NOTE]
> *Comparison accurate as of October 2026 based on publicly available documentation, pricing pages, and repository manifests. Product names and trademarks are property of their respective owners.*

---

## 📄 License & Open-Core Model

ReviewGround is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.  
- ✅ **Free to use** for open-source projects, personal repositories, and internal enterprise organizations.
- 🛡️ **Protects against closed-source cloud SaaS clones**: Any company offering ReviewGround as a hosted commercial SaaS service must contribute their modifications back under AGPLv3.

---

<div align="center">
Built with ❤️ for software engineering teams worldwide.
</div>
