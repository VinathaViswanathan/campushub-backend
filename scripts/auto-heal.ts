/**
 * Auto-heal runner for CI (Lab 8).
 *
 * Reads a failing Jest log, gathers the source files involved (the branch diff plus files named in
 * the log), asks an AI model for a patch, applies it, and re-runs the full test suite. The patch is
 * kept only if every test passes. Guardrail: the model may change only existing, non-test `.ts`
 * files under src/, so it cannot "fix" a failure by editing test assertions.
 *
 * Usage:  npx tsx scripts/auto-heal.ts test-results.log
 *
 * Environment:
 *   GITHUB_TOKEN       GitHub Models (default provider; needs `permissions: models: read`)
 *   ANTHROPIC_API_KEY  optional; uses Anthropic instead when set
 *   AI_MODEL           optional model override
 *   AI_BASE_URL        optional endpoint override (used for local dry runs)
 *   BASE_SHA           commit to diff against (the PR base); empty = no diff context
 *   MAX_ATTEMPTS       default 2
 *
 * Outputs: auto-heal-pr.md (PR body), auto-heal-files.txt (files to commit), and `fixed=true|false`
 * in $GITHUB_OUTPUT.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface FilePatch {
  path: string;
  content: string;
}
interface AgentReply {
  explanation: string;
  files: FilePatch[];
}
interface TestRun {
  passed: boolean;
  output: string;
}

const LIMITS = { log: 6_000, diff: 4_000, fileChars: 12_000, totalFileChars: 14_000, files: 3 };
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 2);
const useAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = process.env.AI_MODEL ?? (useAnthropic ? 'claude-sonnet-5-5' : 'openai/gpt-4.1');

const SYSTEM_PROMPT = `You are an automated repair agent in a CI pipeline for a TypeScript Express + Mongoose API.
Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests.
Rules:
- The tests are the specification. Never change test files or assertions; fix the application code.
- Prefer the smallest change that restores correct behavior. Use the branch diff to find what broke.
- Only modify files you were given. Return every modified file in full.
Reply with ONLY a JSON object, no markdown fences:
{"explanation": "<root cause and fix, 2-4 sentences>", "files": [{"path": "src/...", "content": "<entire new file>"}]}`;

// ---------------------------------------------------------------- helpers

function sh(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;
}

function setOutput(name: string, value: string): void {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function summary(markdown: string): void {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  console.log(markdown);
}

/** Guardrail: only existing, non-test TypeScript files under src/. */
export function isPatchable(filePath: string): boolean {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, '/'));
  return (
    normalized === filePath &&
    normalized.startsWith('src/') &&
    normalized.endsWith('.ts') &&
    !normalized.includes('/__tests__/') &&
    !normalized.startsWith('src/test/') &&
    existsSync(normalized)
  );
}

/** The "●" blocks Jest prints for each failing test, plus the summary lines. */
export function extractFailures(log: string): string {
  const clean = stripAnsi(log);
  const blocks = clean.split(/\n(?=\s*● )/).filter((block) => /^\s*● /.test(block));
  const summaryLines = clean.split('\n').filter((line) => /^(Tests|Test Suites):/.test(line.trim()));
  const body = blocks.length > 0 ? blocks.join('\n') : clean;
  return truncate(`${body}\n${summaryLines.join('\n')}`, LIMITS.log);
}

export function failingTestNames(log: string): string[] {
  return [...stripAnsi(log).matchAll(/^\s*● (.+)$/gm)].map((m) => m[1]!.trim()).filter((n) => n !== 'Console');
}

/** Source files implicated by the log: stack frames, plus the subject of each failing test file. */
export function filesFromLog(log: string): string[] {
  const found = new Set<string>();
  for (const match of stripAnsi(log).matchAll(/src\/[\w/.-]+\.ts/g)) {
    const file = match[0];
    const subject = file.replace(/\/__tests__\/([\w.-]+)\.test\.ts$/, '/$1.ts');
    for (const candidate of [file, subject]) if (isPatchable(candidate)) found.add(candidate);
  }
  return [...found];
}

function changedFiles(baseSha: string): string[] {
  if (!baseSha) return [];
  return sh('git', ['diff', '--name-only', `${baseSha}...HEAD`, '--', 'src'])
    .split('\n')
    .map((line) => line.trim())
    .filter(isPatchable);
}

function branchDiff(baseSha: string): string {
  if (!baseSha) return '(no base commit available)';
  const diff = sh('git', ['diff', `${baseSha}...HEAD`, '--', 'src', ':(exclude)src/**/__tests__/**', ':(exclude)src/test/**']);
  return truncate(diff.trim() || '(no source changes on this branch)', LIMITS.diff);
}

function runTests(): TestRun {
  const result = spawnSync('npx', ['jest', '--ci'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return { passed: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function testSummaryLine(output: string): string {
  const line = stripAnsi(output).split('\n').find((l) => l.trim().startsWith('Tests:'));
  return line ? line.trim().replace(/\s+/g, ' ') : '(no summary)';
}

// ---------------------------------------------------------------- model call

async function callModel(userPrompt: string): Promise<string> {
  const body = useAnthropic
    ? { model: MODEL, max_tokens: 8_000, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userPrompt }] }
    : { model: MODEL, temperature: 0, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }] };
  const url =
    process.env.AI_BASE_URL ??
    (useAnthropic ? 'https://api.anthropic.com/v1/messages' : 'https://models.github.ai/inference/chat/completions');
  const headers: Record<string, string> = useAnthropic
    ? { 'x-api-key': process.env.ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    : {
        // Exactly the headers GitHub documents for the Models inference API. GitHub's REST-style
        // headers (Accept: application/vnd.github+json, X-GitHub-Api-Version) made the endpoint
        // answer a bare "OK" instead of running the model.
        Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ''}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (response.ok) {
      const raw = await response.text();
      let data: { choices?: { message?: { content?: string } }[]; content?: { type: string; text?: string }[] };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        const contentType = response.headers.get('content-type') ?? 'unknown';
        throw new Error(
          `Model endpoint ${url} returned HTTP ${response.status} (${contentType}) that is not JSON: ${JSON.stringify(truncate(raw, 200))}`,
        );
      }
      const text = useAnthropic
        ? (data.content ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('')
        : (data.choices?.[0]?.message?.content ?? '');
      if (text) return text;
      throw new Error('Model returned an empty reply.');
    }
    const detail = truncate(await response.text(), 500);
    if (attempt === 2 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`Model request failed: HTTP ${response.status} ${detail}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20_000)); // rate limit or server error: retry once
  }
  throw new Error('unreachable');
}

export function parseReply(text: string): AgentReply {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model reply contained no JSON object.');
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  const reply = parsed as Partial<AgentReply>;
  if (typeof reply.explanation !== 'string' || !Array.isArray(reply.files)) {
    throw new Error('Model reply is missing "explanation" or "files".');
  }
  for (const file of reply.files) {
    if (typeof file?.path !== 'string' || typeof file?.content !== 'string') {
      throw new Error('Each entry in "files" needs string "path" and "content".');
    }
  }
  return reply as AgentReply;
}

function buildPrompt(failures: string, diff: string, files: string[], previous?: { explanation: string; failures: string }): string {
  const sources = files.map((file) => `--- FILE: ${file}\n${readFileSync(file, 'utf8')}`).join('\n\n');
  const retry = previous
    ? `\n\nYOUR PREVIOUS PATCH DID NOT PASS. Previous explanation: ${previous.explanation}\nRemaining failures:\n${previous.failures}\n(The files below are the original versions.)`
    : '';
  return `JEST FAILURE LOG (test-results.log):\n${failures}\n\nBRANCH DIFF (source changes that may have caused the failure):\n${diff}${retry}\n\nSOURCE FILES YOU MAY MODIFY:\n${sources}`;
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const logFile = process.argv[2] ?? 'test-results.log';
  if (!existsSync(logFile)) throw new Error(`Log file not found: ${logFile}`);
  const log = readFileSync(logFile, 'utf8');
  const baseSha = process.env.BASE_SHA ?? '';

  // Candidate files: what the branch changed first, then what the log points at.
  const candidates: string[] = [];
  let budget = LIMITS.totalFileChars;
  for (const file of [...changedFiles(baseSha), ...filesFromLog(log)]) {
    const size = readFileSync(file, 'utf8').length;
    if (candidates.includes(file) || candidates.length >= LIMITS.files || size > LIMITS.fileChars || size > budget) continue;
    candidates.push(file);
    budget -= size;
  }
  if (candidates.length === 0) throw new Error('No patchable source files found in the diff or the log.');

  const failures = extractFailures(log);
  const diff = branchDiff(baseSha);
  const originals = new Map(candidates.map((file) => [file, readFileSync(file, 'utf8')]));
  const restore = (): void => originals.forEach((content, file) => writeFileSync(file, content));
  console.log(`Model: ${MODEL} via ${useAnthropic ? 'Anthropic' : 'GitHub Models'}; candidate files: ${candidates.join(', ')}`);

  let previous: { explanation: string; failures: string } | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    restore();
    const reply = parseReply(await callModel(buildPrompt(failures, diff, candidates, previous)));
    const rejected = reply.files.filter((file) => !originals.has(file.path));
    if (rejected.length > 0) {
      summary(`Attempt ${attempt}: rejected edits outside the allowed files: ${rejected.map((f) => f.path).join(', ')}`);
    }
    const accepted = reply.files.filter((file) => originals.has(file.path) && file.content !== originals.get(file.path));
    accepted.forEach((file) => writeFileSync(file.path, file.content));
    console.log(`Attempt ${attempt}: ${reply.explanation}\nPatched: ${accepted.map((f) => f.path).join(', ') || '(nothing)'}`);

    const result = accepted.length > 0 ? runTests() : { passed: false, output: 'The model changed no allowed files.' };
    if (result.passed) {
      const changed = accepted.map((file) => file.path);
      writeFileSync('auto-heal-files.txt', `${changed.join('\n')}\n`);
      writeFileSync('auto-heal-pr.md', prBody(reply.explanation, changed, failingTestNames(log), testSummaryLine(result.output), attempt));
      setOutput('fixed', 'true');
      summary(`### Auto-heal succeeded on attempt ${attempt}\n${reply.explanation}\n\n${testSummaryLine(result.output)}`);
      return;
    }
    previous = { explanation: reply.explanation, failures: extractFailures(result.output) };
  }

  restore();
  setOutput('fixed', 'false');
  summary(`### Auto-heal could not produce a passing patch in ${MAX_ATTEMPTS} attempts\nA human needs to fix this failure.`);
  process.exitCode = 1;
}

function prBody(explanation: string, files: string[], failing: string[], testLine: string, attempts: number): string {
  const runUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY ?? ''}/actions/runs/${process.env.GITHUB_RUN_ID ?? ''}`;
  const diff = sh('git', ['diff', '--', ...files]);
  const failingList = failing.slice(0, 15).map((name) => `- ${name}`).join('\n') || '- (see CI log)';
  return `## Auto-heal patch

Generated by the \`auto-fix\` job after the test job failed in [CI run ${process.env.GITHUB_RUN_ID ?? ''}](${runUrl}).

### Failing tests (from \`test-results.log\`)
${failingList}${failing.length > 15 ? `\n- …and ${failing.length - 15} more` : ''}

### Agent diagnosis
${explanation}

### Patch
Files changed: ${files.map((f) => `\`${f}\``).join(', ')}

<details><summary>Diff</summary>

\`\`\`diff
${truncate(diff, 20_000)}
\`\`\`
</details>

### Automated checks
- Guardrail: only non-test files under \`src/\` could be changed; no test files or assertions were modified.
- Full Jest suite after the patch: **${testLine}**
- Model: \`${MODEL}\` (${useAnthropic ? 'Anthropic' : 'GitHub Models'}), attempts: ${attempts}

## Human-in-the-loop review
_To be completed by the reviewer before merging._
- [ ] The diff fixes the root cause shown in the failure log (not a workaround)
- [ ] No test files, assertions, or test data were changed
- [ ] The change is minimal and matches the intended business rule
- [ ] Tests re-run and pass

**Reviewer notes / decision:**
`;
}

if (require.main === module) {
  main().catch((err: unknown) => {
    setOutput('fixed', 'false');
    summary(`### Auto-heal failed\n${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
