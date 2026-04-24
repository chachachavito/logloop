#!/usr/bin/env node

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');
const { loadConfig, saveConfig, GLOBAL_DIR } = require('../src/config');
const { classifyMood, allowedMoods } = require('../src/classifier');
const { saveLog } = require('../src/core');
const { t } = require('../src/i18n');

const config = loadConfig();
const args = process.argv.slice(2);

// --- Command Handlers ---

function handleConfig(args) {
  const [cmd, key, value] = args;

  if (!cmd || (cmd !== 'get' && cmd !== 'set')) {
    console.log(`${t('cli.configUsage')}`);
    process.exit(0);
  }

  if (cmd === 'get') {
    if (!key) {
      console.log('Current config:', config);
    } else {
      console.log(config[key] !== undefined ? config[key] : `Key "${key}" not defined.`);
    }
  } else if (cmd === 'set') {
    if (!key || value === undefined) {
      console.error('\x1b[31m%s\x1b[0m', 'Error: Key and value are required for "set".');
      process.exit(1);
    }
    config[key] = value === 'true' ? true : value === 'false' ? false : value;
    saveConfig(config);
    console.log('\x1b[32m%s\x1b[0m', `✓ Config "${key}" updated to: ${config[key]}`);
  }
  process.exit(0);
}

function showHelp() {
  console.log(`
${t('cli.usage')}

${t('cli.options')}
  ${t('cli.optCommit')}
  ${t('cli.optNoCommit')}
  ${t('cli.optMood')}
  ${t('cli.optVersion')}
  ${t('cli.optHelp')}

${t('cli.configTitle')}
  ${t('cli.configUsage')}
  `);
}

function run(note, moodFlag, shouldCommit) {
  const detected = classifyMood(note);
  let finalMood = moodFlag;

  if (!moodFlag && config.moodTracking && detected !== 'unidentified') {
    finalMood = detected;
  }

  saveLog(note, { shouldCommit, mood: finalMood });

  if (finalMood && config.moodTracking && !moodFlag) {
    console.log(`\x1b[35m${t('cli.moodDetected')} ${finalMood}\x1b[0m`);
  }
}

function handleList() {
  const logsDir = path.join(GLOBAL_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    console.log(`\x1b[90m${t('cli.noLocalLogs')}\x1b[0m`);
    process.exit(0);
  }

  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log(`\x1b[90m${t('cli.noLocalLogs')}\x1b[0m`);
    process.exit(0);
  }

  console.log(`\n\x1b[1m${t('cli.listHeader')}\x1b[0m`);
  console.log(`\x1b[90m${'─'.repeat(60)}\x1b[0m`);

  files.forEach(file => {
    const fullPath = path.join(logsDir, file);
    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const entryCount = (content.match(/\n## \[/g) || []).length;
    
    const project = file.split('.')[0];
    const lastUpdate = stats.mtime.toLocaleString();
    
    const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
    console.log(`${pad(project, 20)} ${pad(entryCount.toString(), 10)} ${lastUpdate}`);
  });
  console.log('');
  process.exit(0);
}

// --- Main execution ---

if (args.includes('-v') || args.includes('--version')) {
  console.log(`logloop v${pkg.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(0);
}

if (args[0] === 'config') {
  handleConfig(args.slice(1));
}

if (args[0] === 'list' || args[0] === 'ls') {
  handleList();
}

const noCommitFlag = args.includes('--no-commit');
const commitFlag = args.includes('--commit');
const moodIndex = args.indexOf('--mood');
const moodFlag = moodIndex !== -1 ? args[moodIndex + 1] : null;

const filteredArgs = args.filter((a, i) => {
  if (['--commit', '--no-commit'].includes(a)) return false;
  if (a === '--mood') return false;
  if (i > 0 && args[i - 1] === '--mood') return false;
  if (['config', 'list', 'ls'].includes(a)) return false;
  return true;
});
const noteArg = filteredArgs.join(' ');

let shouldCommit = false;
if (noCommitFlag) {
  shouldCommit = false;
} else if (commitFlag) {
  shouldCommit = true;
} else if (config.autoCommit !== undefined) {
  shouldCommit = !!config.autoCommit;
}

if (noteArg) {
  run(noteArg, moodFlag, shouldCommit);
} else {
  const { startLoop } = require('../src/ui');
  const { getGitUser } = require('../src/git');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const start = () => {
    rl.close();
    startLoop(config, moodFlag, shouldCommit);
  };

  if (!config.userName) {
    const gitUser = getGitUser();
    if (gitUser) {
      config.userName = gitUser;
      saveConfig(config);
      start();
    } else {
      rl.question(`\x1b[35m› \x1b[0m${t('ui.promptName')}`, (answer) => {
        if (answer.trim()) {
          config.userName = answer.trim();
          saveConfig(config);
        }
        start();
      });
    }
  } else {
    start();
  }
}
