/**
 * ReviewGround - Mermaid Diagram Sanitizer
 * Automatically validates and heals common LLM-generated Mermaid syntax glitches
 * (such as repeated arrow tokens: e.g. `->->`, hallucinated words inside arrows:
 * e.g. `--yminus->>`, `--return->>`, `-call->>`, flowchart contamination: `-.->`, `==>`,
 * semicolons inside message labels, or truncated/unclosed code fences) to prevent
 * GitHub Markdown rendering errors ("Unable to render rich display").
 */

/**
 * Heals sequence diagram arrows by stripping repeated arrowheads, flowchart syntax,
 * hallucinated words or extra characters, semicolons inside message text, and prunes
 * any dangling incomplete lines at the end of truncated diagrams.
 * Examples:
 *   `Dev->->GH`               -> `Dev->>GH`
 *   `A-->-->B`                -> `A-->>B`
 *   `A->>>B`                  -> `A->>B`
 *   `DB--yminus->>PaymentAPI` -> `DB-->>PaymentAPI`
 *   `A-.->>B`                 -> `A-->>B`
 *   `A==>B`                   -> `A->>B`
 *   `A->>B: Step 1; Step 2`   -> `A->>B: Step 1, Step 2`
 *   `participant Loop`        -> `participant Loop_Service as Loop`
 */
export function sanitizeSequenceDiagram(text: string): string {
  const lines = text.split('\n');
  const sanitizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let cleaned = lines[i];

    // Strip trailing semicolons at end of line (e.g. `autonumber;`, `participant A;`)
    cleaned = cleaned.replace(/;\s*$/, '');

    // Protect standalone reserved keywords used as participant/actor IDs
    cleaned = cleaned.replace(
      /^(\s*(?:participant|actor)\s+)(loop|alt|opt|par|critical|break|rect|end|note)(\s*)$/i,
      '$1$2_Service as $2$3'
    );

    // Fix repeated arrows/arrowheads: e.g. `->->`, `-->-->`, `->->>`, `->>>`
    cleaned = cleaned.replace(/-->\s*-->+/g, '-->>');
    cleaned = cleaned.replace(/(?<!-)->\s*->+/g, '->>');
    cleaned = cleaned.replace(/-->>{2,}/g, '-->>');
    cleaned = cleaned.replace(/(?<!-)->>{2,}/g, '->>');

    // Fix flowchart syntax leaked into sequence diagrams (e.g. `-.->`, `-.->>`, `==>`, `==>>`)
    cleaned = cleaned.replace(/-\.-*>>/g, '-->>');
    cleaned = cleaned.replace(/-\.-*>/g, '-->');
    cleaned = cleaned.replace(/={2,}>>/g, '->>');
    cleaned = cleaned.replace(/={2,}>/g, '->>');
    cleaned = cleaned.replace(/<-->>/g, '-->>');
    cleaned = cleaned.replace(/<-+>/g, '->>');

    // Fix excessive hyphens (sequence diagrams strictly require 1 or 2 hyphens)
    cleaned = cleaned.replace(/-{3,}(>>|x|\))/g, '--$1');
    cleaned = cleaned.replace(/-{3,}>/g, '-->');
    cleaned = cleaned.replace(/-{3,}/g, '-->');

    // Fix dotted arrow with embedded word: e.g. --yminus->> or --return->> or --something->>
    cleaned = cleaned.replace(/--[a-zA-Z0-9_]+->>/g, '-->>');

    // Fix solid arrow with embedded word: e.g. -call->> or -fetch->>
    cleaned = cleaned.replace(/(?<!-)-[a-zA-Z0-9_]+->>/g, '->>');

    // Fix dotted open arrow with embedded word: e.g. --yminus--> or --response->
    cleaned = cleaned.replace(/--[a-zA-Z0-9_]+-->/g, '-->');
    cleaned = cleaned.replace(/--[a-zA-Z0-9_]+->(?!>)/g, '-->');

    // Fix solid open arrow with embedded word: e.g. -call--> or -call->
    cleaned = cleaned.replace(/(?<!-)-[a-zA-Z0-9_]+-->/g, '-->');
    cleaned = cleaned.replace(/(?<!-)-[a-zA-Z0-9_]+->(?!>)/g, '->');

    // Fix embedded word in async arrows: e.g. -call-) or --async-)
    cleaned = cleaned.replace(/(?<!-)-[a-zA-Z0-9_]+-\)/g, '-)');
    cleaned = cleaned.replace(/--[a-zA-Z0-9_]+-\)/g, '--))');

    // Fix broken arrow spacing: e.g. `- - >>` or `-- >>` or `- >>` or `-> >` or `- >` or `-- >`
    cleaned = cleaned.replace(/-\s+-/g, '--');
    cleaned = cleaned.replace(/--\s+>>/g, '-->>');
    cleaned = cleaned.replace(/(?<!-)-\s+>>/g, '->>');
    cleaned = cleaned.replace(/->\s+>/g, '->>');
    cleaned = cleaned.replace(/--\s+>/g, '-->');
    cleaned = cleaned.replace(/(?<!-)-\s+>/g, '->');

    // Sanitize semicolons inside message bodies (after `: `) to prevent GitHub statement split crashes
    const arrowMessageMatch = cleaned.match(/^(\s*[^:]*(?:->>|-->>|->|-->|-x|--x|-\)|--\))\s*[^:]*:\s*)(.*)$/);
    if (arrowMessageMatch) {
      const prefix = arrowMessageMatch[1];
      const message = arrowMessageMatch[2];
      const safeMessage = message.replace(/;/g, ',');
      cleaned = prefix + safeMessage;
    }

    sanitizedLines.push(cleaned);
  }

  // Prune trailing dangling incomplete lines caused by token truncation (e.g. line ending with dangling arrow)
  while (sanitizedLines.length > 0) {
    const last = sanitizedLines[sanitizedLines.length - 1].trim();
    if (
      last === '' ||
      /(?:->>|-->>|->|-->|-x|--x|-\)|--\))\s*$/.test(last) ||
      /[-=]>$/.test(last)
    ) {
      sanitizedLines.pop();
    } else {
      break;
    }
  }

  return sanitizedLines.join('\n');
}

/**
 * Detects and heals unclosed ```mermaid blocks caused by LLM token limit truncation.
 * If the unclosed block has no interactions/arrows at all (aborted stub), it is stripped
 * along with any dangling intro header to prevent empty rendering glitches.
 * If it has valid interactions, dangling incomplete lines are pruned and the fence is closed.
 */
export function healUnclosedMermaid(markdown: string): string {
  if (!markdown || !markdown.includes('```mermaid')) {
    return markdown;
  }

  // Matches an unclosed ```mermaid block that has no closing ```
  const unclosedMatch = markdown.match(/```mermaid\s*((?:(?!```)[\s\S])*)$/);
  if (!unclosedMatch) {
    return markdown;
  }

  const diagramBody = unclosedMatch[1] || '';
  const hasArrows = /(?:->>|-->>|->|-->|-x|--x|-\)|--\))/.test(diagramBody);

  if (!hasArrows) {
    // Aborted diagram with zero interactions (e.g. token ceiling hit after just participant line)
    // Strip the broken aborted mermaid block and any preceding diagram section header
    const beforeDiagram = markdown.slice(0, unclosedMatch.index).trimEnd();
    const cleanedBefore = beforeDiagram
      .replace(
        /###?\s*(?:Architectural\s+Sequence|Workflow\s+Visualization|Architecture\s+&\s+Workflow|Sequence\s+Diagram)[^\n]*\n*(?:[^\n]*diagram[^\n]*\n*)?$/i,
        ''
      )
      .trimEnd();
    return cleanedBefore;
  }

  const sanitizedBody = sanitizeSequenceDiagram(diagramBody).trim();
  const before = markdown.slice(0, unclosedMatch.index);
  return `${before}\`\`\`mermaid\n${sanitizedBody}\n\`\`\``;
}

/**
 * Scans markdown text for ```mermaid code blocks and sanitizes their content
 * to prevent GitHub "Unable to render rich display" parse errors.
 */
export function sanitizeMermaidInMarkdown(markdown: string): string {
  if (!markdown || !markdown.includes('```mermaid')) {
    return markdown;
  }

  // 1. First heal any unclosed ```mermaid block at the end of the text
  let healed = healUnclosedMermaid(markdown);

  // 2. Sanitize all closed ```mermaid ... ``` code blocks
  healed = healed.replace(/```mermaid\s*([\s\S]*?)```/g, (_fullMatch, diagramBody: string) => {
    let sanitized = diagramBody;
    if (sanitized.includes('sequenceDiagram')) {
      sanitized = sanitizeSequenceDiagram(sanitized);
    }
    return `\`\`\`mermaid\n${sanitized.trim()}\n\`\`\``;
  });

  return healed;
}

/**
 * Guarantees that any markdown code fences (```) are balanced.
 * If an odd number of fences is present, appends a closing ``` to prevent
 * following markdown sections (<details>, tables, footers) from leaking inside.
 */
export function ensureBalancedCodeFences(markdown: string): string {
  if (!markdown) return markdown;
  const matches = markdown.match(/```/g);
  if (matches && matches.length % 2 !== 0) {
    return `${markdown.trimEnd()}\n\`\`\`\n`;
  }
  return markdown;
}
