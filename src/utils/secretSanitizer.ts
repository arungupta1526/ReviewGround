/**
 * ReviewGround - Pre-Flight Diff Secret & PII Sanitizer
 * Redacts accidental secrets, credentials, tokens, and private keys from git diffs
 * BEFORE they are dispatched across the network to external LLM providers.
 */

export interface SanitizeResult {
  sanitizedDiff: string;
  redactedCount: number;
  redactedTypes: string[];
}

interface SecretPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'AWS_ACCESS_KEY',
    regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_SECRET:AWS_KEY]',
  },
  {
    name: 'GITHUB_TOKEN',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|gho_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36})\b/g,
    replacement: '[REDACTED_SECRET:GITHUB_TOKEN]',
  },
  {
    name: 'SLACK_TOKEN',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
    replacement: '[REDACTED_SECRET:SLACK_TOKEN]',
  },
  {
    name: 'OPENAI_KEY',
    regex: /\bsk-proj-[a-zA-Z0-9_-]{48,}\b|\bsk-[a-zA-Z0-9]{48,}\b/g,
    replacement: '[REDACTED_SECRET:OPENAI_KEY]',
  },
  {
    name: 'ANTHROPIC_KEY',
    regex: /\bsk-ant-[a-zA-Z0-9_-]{48,}\b/g,
    replacement: '[REDACTED_SECRET:ANTHROPIC_KEY]',
  },
  {
    name: 'STRIPE_KEY',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,}|pk_live_[0-9a-zA-Z]{24,})\b/g,
    replacement: '[REDACTED_SECRET:STRIPE_KEY]',
  },
  {
    name: 'GOOGLE_API_KEY',
    regex: /\bAIza[0-9A-Za-z\\-_]{35}\b/g,
    replacement: '[REDACTED_SECRET:GOOGLE_API_KEY]',
  },
  {
    name: 'HUGGINGFACE_TOKEN',
    regex: /\bhf_[a-zA-Z0-9]{34,}\b/g,
    replacement: '[REDACTED_SECRET:HUGGINGFACE_TOKEN]',
  },
  {
    name: 'SENDGRID_KEY',
    regex: /\bSG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}\b/g,
    replacement: '[REDACTED_SECRET:SENDGRID_KEY]',
  },
  {
    name: 'TWILIO_KEY',
    regex: /\bSK[0-9a-fA-F]{32}\b/g,
    replacement: '[REDACTED_SECRET:TWILIO_KEY]',
  },
  {
    name: 'DISCORD_BOT_TOKEN',
    regex: /\b[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,}\b/g,
    replacement: '[REDACTED_SECRET:DISCORD_TOKEN]',
  },
  {
    name: 'POSTMAN_KEY',
    regex: /\bPMAK-[a-zA-Z0-9]{24,}\b/g,
    replacement: '[REDACTED_SECRET:POSTMAN_KEY]',
  },
  {
    name: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    replacement: '[REDACTED_SECRET:PRIVATE_KEY]',
  },
  {
    name: 'JWT_TOKEN',
    regex: /\b(Bearer\s+)?eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    replacement: '$1[REDACTED_SECRET:JWT_TOKEN]',
  },
  {
    name: 'GENERIC_ASSIGNED_KEY',
    regex: /((?:api_?key|auth_?token|secret_?key|access_?token|client_?secret)\s*[:=]\s*["'])(?:(?!\$\{)[a-zA-Z0-9_\-]{24,})(["'])/gi,
    replacement: '$1[REDACTED_SECRET:GENERIC_KEY]$2',
  },
];

/**
 * Sanitizes a diff string by masking known secret signatures.
 */
export function sanitizeDiffSecrets(diffText: string): SanitizeResult {
  if (!diffText || typeof diffText !== 'string') {
    return { sanitizedDiff: '', redactedCount: 0, redactedTypes: [] };
  }

  let sanitized = diffText;
  let totalRedacted = 0;
  const typesDetected = new Set<string>();

  for (const { name, regex, replacement } of SECRET_PATTERNS) {
    const matches = sanitized.match(regex);
    if (matches && matches.length > 0) {
      totalRedacted += matches.length;
      typesDetected.add(name);
      sanitized = sanitized.replace(regex, replacement);
    }
  }

  return {
    sanitizedDiff: sanitized,
    redactedCount: totalRedacted,
    redactedTypes: Array.from(typesDetected),
  };
}
