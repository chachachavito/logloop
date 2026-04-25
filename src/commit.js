const { execSync } = require('child_process');
const pc = require('picocolors');
const { getRecentLogs } = require('./core');
const { isGitRepo, isDirty } = require('./git');

function hasSelfCommit() {
  try {
    execSync('command -v self-commit', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function generateFallbackMessage(log) {
  if (!log) return 'chore: logloop auto-commit';
  const type = log.type || 'chore';
  const note = (log.note || '').split('\n')[0].substring(0, 60);
  return `${type}: ${note} (#${log.id})`;
}

function handleCommit(args, config) {
  const isDryRun = args.includes('--dry-run');
  const forceAi = args.includes('--ai');
  const noAi = args.includes('--no-ai');
  
  let userMessage = null;
  const msgIdx = args.findIndex(a => a === '-m' || a === '--message');
  if (msgIdx > -1 && args[msgIdx + 1]) {
    userMessage = args[msgIdx + 1];
  }

  if (!isGitRepo()) {
    console.error(pc.red('Not a git repository.'));
    process.exit(1);
  }

  if (!isDirty()) {
    console.log(pc.yellow('No changes to commit.'));
    process.exit(0);
  }

  const logs = getRecentLogs(config, 1);
  const lastLog = logs.length > 0 ? logs[0] : null;

  let commitMessage = '';

  if (userMessage) {
    commitMessage = userMessage;
    if (lastLog && !commitMessage.includes(lastLog.id)) {
      commitMessage += ` (#${lastLog.id})`;
    }
  } else if (!noAi && (forceAi || hasSelfCommit())) {
    try {
      if (isDryRun) {
        console.log(pc.cyan('🤖 [Dry Run] Would execute self-commit with context...'));
        commitMessage = generateFallbackMessage(lastLog);
      } else {
        console.log(pc.cyan('🤖 Running self-commit...'));
        const contextArg = lastLog ? `--context "Log ID: ${lastLog.id}\nType: ${lastLog.type}\nNote: ${lastLog.note}"` : '';
        execSync(`self-commit ${contextArg}`, { stdio: 'inherit' });
        process.exit(0);
      }
    } catch (e) {
      if (forceAi) {
        console.error(pc.red('🤖 self-commit failed or is not installed.'));
        process.exit(1);
      }
      console.log(pc.yellow('🤖 self-commit not found or failed. Using fallback.'));
      commitMessage = generateFallbackMessage(lastLog);
    }
  } else {
    commitMessage = generateFallbackMessage(lastLog);
  }

  if (isDryRun) {
    console.log(pc.magenta('\n--- Dry Run Preview ---'));
    console.log(pc.green('Command:'), `git commit -m "${commitMessage}"`);
    process.exit(0);
  }

  try {
    execSync('git add -A', { stdio: 'ignore' });
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log(pc.green('✓ Commit successful.'));
  } catch (e) {
    console.error(pc.red('Commit failed.'));
    process.exit(1);
  }
}

module.exports = { handleCommit };
