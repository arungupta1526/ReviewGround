/**
 * ReviewGround - GitHub Action Entrypoint
 */

import * as core from '@actions/core';
import * as fs from 'fs';
import { runReview, ReviewerConfig } from './reviewer.js';
import { runSummary, SummaryConfig } from './summary.js';

function getOptionalInput(name: string, envFallback?: string): string {
  const val = core.getInput(name);
  if (val && val.trim().length > 0) return val.trim();
  if (envFallback && process.env[envFallback]) return (process.env[envFallback] || '').trim();
  return '';
}

function getBooleanInput(name: string, defaultValue = true): boolean {
  const val = core.getInput(name);
  if (!val) return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}

function resolvePrNumber(): string {
  const inputPr = getOptionalInput('pr-number', 'PR_NUMBER');
  if (inputPr) return inputPr;

  // Inspect GitHub event payload if available
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
      const prNumber = eventData.pull_request?.number || eventData.issue?.number;
      if (prNumber) return String(prNumber);
    } catch {
      // Ignore JSON parse error
    }
  }

  return '';
}

async function run(): Promise<void> {
  try {
    const token = getOptionalInput('github-token', 'GITHUB_TOKEN');
    const repo = getOptionalInput('repo', 'GITHUB_REPOSITORY');
    const prNumber = resolvePrNumber();
    const mode = (getOptionalInput('mode') || 'all').toLowerCase();

    console.log('🚀 ReviewGround GitHub Action Initializing...');
    console.log(`- Repository: ${repo || 'local'}`);
    console.log(`- PR Number: ${prNumber || 'N/A (Push or non-PR context)'}`);
    console.log(`- Execution Mode: ${mode}`);

    const baseConfig = {
      githubToken: token,
      repo,
      prNumber,
      commentTag: getOptionalInput('comment-tag') || undefined,
    };

    // Mode: review or all
    if (mode === 'review' || mode === 'all' || mode === 'both') {
      const reviewConfig: ReviewerConfig = {
        ...baseConfig,
        baseBranch: getOptionalInput('base-branch') || 'main',
        provider: getOptionalInput('provider', 'PROVIDER') || undefined,
        model: getOptionalInput('model') || undefined,
        enableSearchGrounding: getBooleanInput('enable-search-grounding', true),
        enableInlineSuggestions: getBooleanInput('enable-inline-suggestions', true),
        enableNpmVerify: getBooleanInput('enable-npm-verify', true),
        geminiApiKey: getOptionalInput('gemini-api-key', 'GEMINI_API_KEY') || undefined,
        openaiApiKey: getOptionalInput('openai-api-key', 'OPENAI_API_KEY') || undefined,
        anthropicApiKey: getOptionalInput('anthropic-api-key', 'ANTHROPIC_API_KEY') || undefined,
        groqApiKey: getOptionalInput('groq-api-key', 'GROQ_API_KEY') || undefined,
        deepseekApiKey: getOptionalInput('deepseek-api-key', 'DEEPSEEK_API_KEY') || undefined,
        llmBaseUrl: getOptionalInput('llm-base-url', 'LLM_BASE_URL') || undefined,
        llmApiKey: getOptionalInput('llm-api-key', 'LLM_API_KEY') || undefined,
      };

      console.log('\n--- 🤖 Starting AI Code Review ---');
      const reviewResult = await runReview(reviewConfig);
      core.setOutput('reviewed', reviewResult ? 'true' : 'false');
      if (reviewResult) {
        core.setOutput('reviewer-engine', `${reviewResult.provider} (${reviewResult.model})`);
      }
    }

    // Mode: summary or all
    if (mode === 'summary' || mode === 'all' || mode === 'both') {
      const summaryConfig: SummaryConfig = {
        ...baseConfig,
        runId: getOptionalInput('run-id', 'GITHUB_RUN_ID') || undefined,
        gitleaksResult: getOptionalInput('gitleaks-result', 'GITLEAKS_RESULT') || undefined,
        auditResult: getOptionalInput('audit-result', 'AUDIT_RESULT') || undefined,
        buildResult: getOptionalInput('build-result', 'BUILD_RESULT') || undefined,
        testResult: getOptionalInput('test-result', 'TEST_RESULT') || undefined,
      };

      console.log('\n--- 📊 Starting Post-CI Summary ---');
      const summaryMarkdown = await runSummary(summaryConfig);
      core.setOutput('summarized', 'true');
      core.setOutput('summary-markdown', summaryMarkdown);
    }

    console.log('\n✨ ReviewGround completed successfully.');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`ReviewGround Action failed: ${msg}`);
  }
}

void run();
