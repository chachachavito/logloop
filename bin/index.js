#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
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
      console.log('\x1b[32m%s\x1b[0m', t('cli.success') || '✓ Saved.');
      if (finalMood && config.moodTracking && !moodFlag) {
        console.log(`\x1b[35m${t('cli.moodDetected')} ${finalMood}\x1b[0m`);
      }
    }
  } catch (err) {
    if (err.message === 'LOCK_TIMEOUT') {
      console.error(`\x1b[31m[logloop] ${t('cli.lockError')}\x1b[0m`);
    } else {
      console.error(`\x1b[31m[logloop] Error: ${err.message}\x1b[0m`);
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
