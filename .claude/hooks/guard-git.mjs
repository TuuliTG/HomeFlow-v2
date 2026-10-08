// PreToolUse hook: keeps agents off `main` (see docs/adr/0001-how-we-work.md).
// Exit code 2 blocks the tool call and shows stderr to the agent.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { tool_input: toolInput } = JSON.parse(readFileSync(0, 'utf8'));
const command = String(toolInput?.command ?? '');

function currentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function block(reason) {
  console.error(
    `${reason} Create a branch named after the change (git switch -c sort-tasks-by-due-date) and open a PR instead.`,
  );
  process.exit(2);
}

const pushesToMain = /\bgit\s+push\b.*[\s:+](main|master)(\s|$)/.test(command);
const commitsOrPushes = /\bgit\s+(commit|push)\b/.test(command);

if (pushesToMain) {
  block('Pushing to main is not allowed.');
}
if (commitsOrPushes && ['main', 'master'].includes(currentBranch())) {
  block('You are on main: committing or pushing here is not allowed.');
}
