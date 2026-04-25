#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const pc = require('picocolors');
const pkg = require('../package.json');
const { loadConfig, saveConfig } = require('../src/config');

// Lazy load helpers
const getI18n = () => require('../src/i18n');
const getClassifier = () => require('../src/classifier');
const getCore = () => require('../src/core');

const config = loadConfig();
const args = process.argv.slice(2);

// Handle flags early
if (args.includes('--debug')) {
  getCore().setDebug(true);
  args.splice(args.indexOf('--debug'), 1);
}
if (args.includes('--durable')) {
  config.durable = true;
  args.splice(args.indexOf('--durable'), 1);
}
if (args.includes('--standalone')) {
  config.standalone = true;
  args.splice(args.indexOf('--standalone'), 1);
}

function t(key) {
  return getI18n().t(key);
}

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
      console.log(`${t('cli.configUsage')}`);
    } else {
      let val = value;
      if (value === 'true') val = true;
      if (value === 'false') val = false;
      config[key] = val;
      saveConfig(config);
      console.log(`Config "${key}" set to ${val}`);
    }
  }
  process.exit(0);
}

function run(note, moodFlag, shouldCommit) {
  const classifier = getClassifier();
  const core = getCore();
  
  const detected = classifier.classifyMood(note);
  let finalMood = moodFlag;

  if (!moodFlag && config.moodTracking && detected.category !== 'neutral') {
    finalMood = detected.category;
  }

  try {
    const success = core.saveLog(note, config, { shouldCommit, mood: finalMood });
    if (success) {
      console.log(pc.green(t('cli.success') || '✓ Saved.'));
      if (finalMood && config.moodTracking && !moodFlag) {
        console.log(pc.magenta(`${t('cli.moodDetected')} ${finalMood}`));
      }
    }
  } catch (err) {
    if (err.message === 'LOCK_TIMEOUT') {
      console.error(pc.red(`[logloop] ${t('cli.lockError')}`));
    } else {
      console.error(pc.red(`[logloop] Error: ${err.message}`));
    }
    process.exit(1);
  }
}

// --- CLI Entry Point ---

if (args.includes('-v') || args.includes('--version')) {
  console.log(`logloop ${pkg.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
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
  process.exit(0);
}

if (args[0] === 'config') {
  handleConfig(args.slice(1));
} else if (args[0] === 'list') {
  // Lazy load list handler if needed
  require('../src/ui').handleList(config);
  process.exit(0);
} else if (args[0] === 'timeline') {
  const { renderTimeline } = require('../src/ui');
  renderTimeline(getCore().getAnalytics(config));
  process.exit(0);
} else if (args[0] === 'summary') {
  const { renderSummary } = require('../src/ui');
  renderSummary(getCore().getAnalytics(config));
  process.exit(0);
} else if (args[0] === 'commit') {
  require('../src/commit').handleCommit(args.slice(1), config);
  process.exit(0);
}

let moodFlag = null;
const moodIdx = args.indexOf('--mood');
if (moodIdx > -1 && args[moodIdx + 1]) {
  moodFlag = args[moodIdx + 1];
  args.splice(moodIdx, 2);
}

const commitFlag = args.includes('--commit');
const noCommitFlag = args.includes('--no-commit');
const filteredArgs = args.filter(a => a !== '--commit' && a !== '--no-commit');
const noteArg = filteredArgs.join(' ');

let shouldCommit = config.autoCommit;
if (noCommitFlag) shouldCommit = false;
else if (commitFlag) shouldCommit = true;

if (noteArg) {
  run(noteArg, moodFlag, shouldCommit);
} else {
  const { startLoop } = require('../src/ui');
  const { getGitUser } = require('../src/git');
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const start = () => {
    rl.close();
    startLoop(config, moodFlag, shouldCommit);
  };

  if (!config.userName) {
    const gitUser = config.standalone ? null : getGitUser();
    if (gitUser) {
      config.userName = gitUser;
      saveConfig(config);
      start();
    } else {
      rl.question(`${pc.magenta('› ')}${t('ui.promptName')}`, (answer) => {
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
