#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import pc from 'picocolors';
import { createRequire } from 'module';
import { loadConfig, saveConfig } from '../src/config.js';
import * as i18n from '../src/i18n.js';
import * as classifier from '../src/classifier.js';
import * as core from '../src/core.js';
import * as ui from '../src/ui.js';
import * as commit from '../src/commit.js';
import { getGitUser } from '../src/git.js';
import readline from 'readline';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const config = await loadConfig();
const args = process.argv.slice(2);

// Handle flags early
if (args.includes('--debug')) {
  core.setDebug(true);
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
  return i18n.t(key);
}

// --- Command Handlers ---

// saveConfig() is async (it awaits db.write()), so this has to be async too —
// the process.exit(0) at the end kills the process before an un-awaited write
// reaches disk, and the setting is silently lost.
async function handleConfig(args) {
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
      await saveConfig(config);
      console.log(`Config "${key}" set to ${val}`);
    }
  }
  process.exit(0);
}

async function run(note, moodFlag, shouldCommit) {
  const detected = await classifier.classifyMood(note);
  let finalMood = moodFlag;

  if (!moodFlag && config.moodTracking) {
    finalMood = detected.category;
  }

  try {
    const success = await core.saveLog(note, config, { shouldCommit, mood: finalMood });
    if (success) {
      const { category } = await classifier.classifyMessage(note);
      const moodTag = (finalMood && config.moodTracking) ? pc.magenta(` [${finalMood}]`) : '';
      console.log(`${pc.green('✓')} ${pc.gray(`[${category}]`)}${moodTag} ${pc.white(note)}`);
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
${pc.bold(pc.white('LOGLOOP'))} ${pc.gray(`v${pkg.version}`)}
${pc.gray('──────')}

${pc.bold(t('cli.usage'))}
  ${pc.cyan('logloop')} ${pc.gray('[message] [options]')}

${pc.bold(t('cli.options'))}
  ${pc.yellow('--commit')}${' '.repeat(7)} ${t('cli.optCommit')}
  ${pc.yellow('--no-commit')}${' '.repeat(4)} ${t('cli.optNoCommit')}
  ${pc.yellow('--mood <mood>')}${' '.repeat(2)} ${t('cli.optMood')}
  ${pc.yellow('--standalone')}${' '.repeat(2)} Skip git context
  ${pc.yellow('-v, --version')}${' '.repeat(1)} ${t('cli.optVersion')}
  ${pc.yellow('-h, --help')}${' '.repeat(4)} ${t('cli.optHelp')}

${pc.bold(t('cli.configTitle'))}
  ${pc.gray(t('cli.configUsage'))}
  `);
  process.exit(0);
}

if (args[0] === 'config') {
  await handleConfig(args.slice(1));
} else if (args[0] === 'list') {
  await ui.handleList(config);
  process.exit(0);
} else if (args[0] === 'timeline') {
  ui.renderTimeline(await core.getAnalytics(config));
  process.exit(0);
} else if (args[0] === 'summary') {
  ui.renderSummary(await core.getAnalytics(config));
  process.exit(0);
} else if (args[0] === 'commit') {
  await commit.handleCommit(args.slice(1), config);
  process.exit(0);
} else if (args[0] === 'global') {
  const globalCmd = args[1];
  const globalLogs = await core.getGlobalLogs();

  if (!globalCmd || globalCmd === 'list') {
    ui.renderGlobalList(globalLogs);
  } else if (globalCmd === 'timeline') {
    ui.renderTimeline(await core.getAnalytics(config, globalLogs));
  } else if (globalCmd === 'summary') {
    ui.renderSummary(await core.getAnalytics(config, globalLogs));
  } else if (globalCmd === 'search') {
    const query = args.slice(2).join(' ');
    const results = globalLogs.filter(l => l.note.toLowerCase().includes(query.toLowerCase()));
    ui.renderGlobalList(results, `Search results for "${query}"`);
  } else if (globalCmd === 'filter') {
    let results = globalLogs;
    const typeIdx = args.indexOf('--type');
    if (typeIdx > -1 && args[typeIdx+1]) {
      results = results.filter(l => l.type === args[typeIdx+1].toLowerCase());
    }
    const moodIdx = args.indexOf('--mood');
    if (moodIdx > -1 && args[moodIdx+1]) {
      results = results.filter(l => l.mood === args[moodIdx+1].toLowerCase());
    }
    ui.renderGlobalList(results, `Filtered results`);
  }
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
  await run(noteArg, moodFlag, shouldCommit);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const start = async () => {
    rl.close();
    await ui.startLoop(config, moodFlag, shouldCommit);
  };

  if (!config.userName) {
    const gitUser = config.standalone ? null : getGitUser();
    if (gitUser) {
      config.userName = gitUser;
      await saveConfig(config);
      await start();
    } else {
      rl.question(`${pc.magenta('› ')}${t('ui.promptName')}`, async (answer) => {
        if (answer.trim()) {
          config.userName = answer.trim();
          await saveConfig(config);
        }
        await start();
      });
    }
  } else {
    await start();
  }
}
