// PostToolUse hook: formats and lint-fixes the file an agent just edited,
// so style never needs a review round. Failures are reported but never block.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { tool_input: toolInput } = JSON.parse(readFileSync(0, 'utf8'));
const filePath = toolInput?.file_path;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const run = (args) => {
  try {
    execFileSync('npx', args, { stdio: 'ignore' });
  } catch {
    // Remaining problems surface in `npm run verify`.
  }
};

if (typeof filePath === 'string' && filePath.startsWith(projectDir)) {
  if (/\.(ts|tsx|js|mjs|json|css|md|ya?ml|html)$/.test(filePath)) {
    run(['prettier', '--write', '--ignore-unknown', filePath]);
  }
  if (/\.(ts|tsx)$/.test(filePath)) {
    run(['eslint', '--fix', filePath]);
  }
}
