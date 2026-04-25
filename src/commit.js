const { execSync } = require('child_process');
const pc = require('picocolors');
const readline = require('readline');
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

function hasStagedChanges() {
  try {
    execSync('git diff --cached --quiet', { stdio: 'ignore' });
    return false; // Exit code 0 means no differences between HEAD and index
  } catch (e) {
    return true; // Exit code 1 means there are staged changes
  }
}

function generateFallbackMessage(log) {
  if (!log) return 'chore: logloop auto-commit';
  const type = log.type || 'chore';
  const note = (log.note || '').split('\n')[0].substring(0, 60);
  return `${type}: ${note} (#${log.id})`;
}

function continueCommit(commitMessage, isDryRun) {
  if (isDryRun) {
    console.log(pc.magenta('\n--- Dry Run Preview ---'));
    console.log(pc.green('Command:'), `git commit -m "${commitMessage}"`);
    process.exit(0);
  }

  try {
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log(pc.green('✓ Commit successful.'));
    process.exit(0);
  } catch (e) {
    console.error(pc.red('Commit failed.'));
    process.exit(1);
  }
}

function executeAiCommit(args, config, userMessage, lastLog, isDryRun) {
  const forceAi = args.includes('--ai');
  const noAi = args.includes('--no-ai');
  let commitMessage = '';

  if (userMessage) {
    commitMessage = userMessage;
    if (lastLog && !commitMessage.includes(lastLog.id)) {
      commitMessage += ` (#${lastLog.id})`;
    }
  } else if (!noAi && (forceAi || hasSelfCommit())) {
    if (!hasSelfCommit()) {
      console.log(pc.yellow('self-commit not installed.'));
      console.log(pc.yellow('Tip: npm install -g self-commit'));
      if (forceAi) process.exit(1);
      commitMessage = generateFallbackMessage(lastLog);
    } else {
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
        console.log(pc.red('AI commit generation failed.'));
        console.log(pc.yellow('Using fallback message.'));
        commitMessage = generateFallbackMessage(lastLog);
      }
    }
  } else {
    commitMessage = generateFallbackMessage(lastLog);
  }

  continueCommit(commitMessage, isDryRun);
}

function handleCommit(args, config) {
  const isDryRun = args.includes('--dry-run');
  const addAll = args.includes('--all');
  
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

  if (addAll) {
    execSync('git add .', { stdio: 'ignore' });
  }

  const logs = getRecentLogs(config, 1);
  const lastLog = logs.length > 0 ? logs[0] : null;

  if (!hasStagedChanges()) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(pc.yellow('No staged changes found.'));
    rl.question('Stage all files? (y/n) ', (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'y') {
        execSync('git add .', { stdio: 'ignore' });
        executeAiCommit(args, config, userMessage, lastLog, isDryRun);
      } else {
        console.log(pc.cyan('Run: git add .'));
        console.log(pc.cyan('Or use: logloop commit --all'));
        process.exit(0);
      }
    });
  } else {
    executeAiCommit(args, config, userMessage, lastLog, isDryRun);
  }
}

module.exports = { handleCommit };
