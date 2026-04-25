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
    return false;
  } catch (e) {
    return true;
  }
}

function getDiffSummary() {
  try {
    return execSync('git diff --cached --stat', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch (e) {
    return null;
  }
}

function generateFallbackMessage(log) {
  if (!log) return 'chore: logloop auto-commit';
  const type = log.type || 'chore';
  const note = (log.note || '').split('\n')[0].substring(0, 60);
  return `${type}: ${note} (#${log.id})`;
}

function generateCommitMessage(args, config, lastLog, skipPrompt) {
  const forceAi = args.includes('--ai');
  const noAi = args.includes('--no-ai');

  let userMessage = null;
  const msgIdx = args.findIndex(a => a === '-m' || a === '--message');
  if (msgIdx > -1 && args[msgIdx + 1]) {
    userMessage = args[msgIdx + 1];
  }

  if (userMessage) {
    let msg = userMessage;
    if (lastLog && !msg.includes(lastLog.id)) {
      msg += ` (#${lastLog.id})`;
    }
    return { message: msg, source: 'manual' };
  }

  if (!noAi && (forceAi || hasSelfCommit())) {
    if (!hasSelfCommit()) {
      console.log(pc.yellow('self-commit not installed.'));
      console.log(pc.dim('Tip: npm install -g self-commit'));
      if (forceAi) process.exit(1);
      return { message: generateFallbackMessage(lastLog), source: 'fallback' };
    }

    try {
      console.log(pc.cyan('🤖 Running self-commit...'));
      const contextArg = lastLog ? `--context "Log ID: ${lastLog.id}\nType: ${lastLog.type}\nNote: ${lastLog.note}"` : '';
      const yesArg = skipPrompt ? '-y' : '';
      execSync(`self-commit ${contextArg} ${yesArg}`, { stdio: 'inherit' });
      process.exit(0);
    } catch (e) {
      console.log(pc.red('AI commit generation failed.'));
      console.log(pc.yellow('Using fallback message.'));
      return { message: generateFallbackMessage(lastLog), source: 'fallback' };
    }
  }

  return { message: generateFallbackMessage(lastLog), source: 'fallback' };
}

function showPreview(commitMessage, source, lastLog) {
  const diff = getDiffSummary();

  console.log('');
  if (diff) {
    console.log(pc.dim('Changes:'));
    diff.split('\n').forEach(line => console.log(pc.dim('  ' + line)));
    console.log('');
  }

  if (lastLog) {
    console.log(pc.dim(`Based on log: #${lastLog.id}`));
  }

  console.log(pc.cyan(`Generated commit message (${source}):`));
  console.log(pc.green(`  ${commitMessage}`));
  console.log('');
}

function promptAction(commitMessage, isDryRun, callback) {
  if (isDryRun) {
    console.log(pc.magenta('--- Dry Run Preview ---'));
    console.log(pc.green('Command:'), `git commit -m "${commitMessage}"`);
    process.exit(0);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(pc.dim('? What would you like to do?'));
  console.log(pc.cyan('  1) Commit'));
  console.log(pc.cyan('  2) Edit message'));
  console.log(pc.cyan('  3) Cancel'));

  rl.question(pc.dim('› '), (answer) => {
    const choice = answer.trim();
    if (choice === '1' || choice === '') {
      rl.close();
      callback(commitMessage);
    } else if (choice === '2') {
      rl.question(pc.dim('New message: '), (newMsg) => {
        rl.close();
        if (newMsg.trim()) {
          callback(newMsg.trim());
        } else {
          callback(commitMessage);
        }
      });
    } else {
      rl.close();
      console.log(pc.yellow('Commit cancelled.'));
      process.exit(0);
    }
  });
}

function executeCommit(commitMessage) {
  try {
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log(pc.green('✓ Commit successful.'));
    process.exit(0);
  } catch (e) {
    console.error(pc.red('Commit failed.'));
    process.exit(1);
  }
}

function handleCommit(args, config) {
  const isDryRun = args.includes('--dry-run');
  const addAll = args.includes('--all');
  const skipPrompt = args.includes('--yes') || args.includes('-y');

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

  if (!hasStagedChanges()) {
    if (skipPrompt && addAll) {
      runCommitFlow(args, config, isDryRun, skipPrompt);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(pc.yellow('No staged changes found.'));
    rl.question('Stage all files? (y/n) ', (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'y') {
        execSync('git add .', { stdio: 'ignore' });
        runCommitFlow(args, config, isDryRun, skipPrompt);
      } else {
        console.log(pc.cyan('Run: git add .'));
        console.log(pc.cyan('Or use: logloop commit --all'));
        process.exit(0);
      }
    });
  } else {
    runCommitFlow(args, config, isDryRun, skipPrompt);
  }
}

function runCommitFlow(args, config, isDryRun, skipPrompt) {
  const logs = getRecentLogs(config, 1);
  const lastLog = logs.length > 0 ? logs[0] : null;

  const { message, source } = generateCommitMessage(args, config, lastLog, skipPrompt);

  showPreview(message, source, lastLog);

  if (skipPrompt) {
    if (isDryRun) {
      console.log(pc.magenta('--- Dry Run Preview ---'));
      console.log(pc.green('Command:'), `git commit -m "${message}"`);
      process.exit(0);
    }
    console.log(pc.cyan('Auto-committing with generated message (--yes)'));
    executeCommit(message);
  } else {
    promptAction(message, isDryRun, executeCommit);
  }
}

module.exports = { handleCommit };
