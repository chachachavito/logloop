const { getRecentLogs, saveLog, getLogFile } = require('./core');
const { classifyMood } = require('./classifier');
const { getGitMetadata, isDirty } = require('./git');
const { t } = require('./i18n');
const { loadConfig, saveConfig } = require('./config');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const moodMap = {
  focused: '🎯', happy: '😊', confused: '🌀', tired: '😴',
  excited: '🚀', anxious: '😰', frustrated: '😤', neutral: '😐', unidentified: '📝'
};

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
const pad = (str, n) => str + ' '.repeat(Math.max(0, n - stripAnsi(str).length));

function render(logs, state) {
  process.stdout.write('\x1Bc');
  const config = loadConfig();
  
  if (!state.showHelp) {
    const storageMode = config.storage === 'local' ? '\x1b[33mLOCAL\x1b[0m' : '\x1b[32mREPO\x1b[0m';
    console.log(`\x1b[90mStorage:\x1b[0m ${storageMode}`);
    console.log(`\x1b[90m${'─'.repeat(50)}\x1b[0m\n`);
  }

  if (state.showHelp) {
    const git = getGitMetadata() || { branch: 'no-repo' };
    const dirty = isDirty() ? '\x1b[31m(dirty)\x1b[0m' : '\x1b[32m(clean)\x1b[0m';
    const cStatus = state.autoCommit ? '\x1b[32mON\x1b[0m' : '\x1b[31mOFF\x1b[0m';
    const mStatus = state.moodTracking ? '\x1b[32mON\x1b[0m' : '\x1b[31mOFF\x1b[0m';
    const storageMode = config.storage === 'local' ? '\x1b[33mLOCAL\x1b[0m' : '\x1b[32mREPO\x1b[0m';

    console.log(`\x1b[1;35m${t('ui.title')}\x1b[0m \x1b[90m| ${t('ui.version')}\x1b[0m`);
    console.log(`\x1b[90m${t('ui.branch')}\x1b[0m ${pad(git.branch, 12)} ${dirty}`);
    console.log(`\x1b[90m${t('ui.config')}\x1b[0m ${t('ui.commit')}${cStatus}  ${t('ui.mood')}${mStatus}  \x1b[90mStorage:\x1b[0m${storageMode}`);
    console.log(`\x1b[90m${'─'.repeat(50)}\x1b[0m\n`);
  }

  if (logs.length === 0) {
    console.log(`  \x1b[90m${t('ui.noLogs')}\x1b[0m`);
  } else {
    logs.forEach(log => {
      const color = log.type === 'decision' ? '\x1b[1;33m' : 
                    log.type === 'question' ? '\x1b[1;34m' : 
                    log.type === 'action' ? '\x1b[1;32m' : '\x1b[36m';
      const moodEmoji = moodMap[log.mood] || '';
      console.log(` \x1b[90m${log.time}\x1b[0m ${color}[${log.type.toUpperCase()}]\x1b[0m ${moodEmoji} ${log.note}`);
    });
  }

  console.log(`\x1b[90m${t('ui.footerDivider')}\x1b[0m`);
  if (state.showHelp) {
    console.log(`\x1b[33m${t('ui.helpTitle')}\x1b[0m`);
    console.log(` \x1b[1m${t('ui.cmdCommit')}\x1b[0m`);
    console.log(` \x1b[1m${t('ui.cmdMood')}\x1b[0m`);
    console.log(` \x1b[1m${t('ui.cmdStorage')}\x1b[0m`);
    console.log(` \x1b[1m/as <cat>\x1b[0m  ${t('ui.cmdAs') || 'Reclassify last log and learn'}`);
    console.log(` \x1b[1m/feel <m>\x1b[0m  ${t('ui.cmdFeel') || 'Correct last mood and learn'}`);
    console.log(` \x1b[1m/e\x1b[0m          ${t('ui.cmdEdit')}`);
    console.log(` \x1b[1m/q\x1b[0m          ${t('ui.cmdQuit')}`);
    console.log(` \x1b[1m/h\x1b[0m          ${t('ui.cmdHelpClose')}`);
    console.log(`\x1b[90m${'─'.repeat(50)}\x1b[0m`);
  } else {
    console.log(`\x1b[90m${t('ui.promptHelp')}\x1b[0m`);
  }
}

function startLoop(initialConfig, moodFlag, initialShouldCommit) {
  const state = { 
    autoCommit: initialShouldCommit, 
    moodTracking: initialConfig.moodTracking, 
    showHelp: false,
    lastInput: null 
  };
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let watcher = null;

  const refresh = () => {
    render(getRecentLogs(state.showHelp ? 10 : 15), state);
    const git = getGitMetadata();
    const branchInfo = git ? `${git.branch}${isDirty() ? '*' : ''} ` : '';
    rl.setPrompt(`\x1b[90m${branchInfo}\x1b[35m› \x1b[0m`);
    rl.prompt();
    updateWatcher();
  };

  const updateWatcher = () => {
    if (watcher) { watcher.close(); watcher = null; }
    const logPath = getLogFile();
    if (fs.existsSync(logPath)) {
      watcher = fs.watch(logPath, (ev) => { if (ev === 'change') refresh(); });
    }
  };

  refresh();

  rl.on('line', (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();

    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts[1];

      if (cmd === '/c' || cmd === '/commit') state.autoCommit = !state.autoCommit;
      else if (cmd === '/m' || cmd === '/mood') state.moodTracking = !state.moodTracking;
      else if (cmd === '/h' || cmd === '/help') state.showHelp = !state.showHelp;
      else if (cmd === '/q' || cmd === '/quit') return rl.close();
      else if (cmd === '/as') {
        if (!state.lastInput) {
          console.log(`\x1b[31mNo recent log to reclassify\x1b[0m`);
        } else if (!arg) {
          console.log(`\x1b[31mUsage: /as <category>\x1b[0m`);
        } else {
          const { updateLastLog } = require('./core');
          const { learn } = require('./classifier');
          if (updateLastLog({ type: arg })) {
            learn(state.lastInput, arg, arg, 'message');
            console.log(`\x1b[32mLast log reclassified as ${arg} and learned! ✨\x1b[0m`);
          }
        }
        setTimeout(refresh, 1000);
        return;
      } else if (cmd === '/feel') {
        if (!state.lastInput) {
          console.log(`\x1b[31mNo recent log to re-mood\x1b[0m`);
        } else if (!arg) {
          console.log(`\x1b[31mUsage: /feel <mood>\x1b[0m`);
        } else {
          const { updateLastLog } = require('./core');
          const { learn } = require('./classifier');
          if (updateLastLog({ mood: arg })) {
            learn(state.lastInput, arg, arg, 'mood');
            console.log(`\x1b[32mLast log mood updated to ${arg} and learned! ✨\x1b[0m`);
          }
        }
        setTimeout(refresh, 1000);
        return;
      } else if (cmd === '/s' || cmd === '/storage') {
        const config = loadConfig();
        config.storage = config.storage === 'local' ? 'repo' : 'local';
        saveConfig(config);
        // O refresh já vai ler a nova config e atualizar o render e o watcher
      } else if (cmd === '/e' || cmd === '/edit') {
        const editor = process.env.EDITOR || 'open';
        const logPath = getLogFile();
        try {
          if (editor === 'open') execSync(`open "${logPath}"`);
          else {
            rl.pause();
            const child = spawn(editor, [logPath], { stdio: 'inherit' });
            child.on('exit', () => { rl.resume(); refresh(); });
            return;
          }
        } catch (e) { console.log(`\x1b[31m${t('ui.errorEditor')}\x1b[0m`); }
      } else {
        console.log(`\x1b[31m${t('ui.unknownCommand')}\x1b[0m`);
        setTimeout(refresh, 1000);
        return;
      }
      refresh();
      return;
    }

    const moodData = state.moodTracking ? classifyMood(input) : null;
    const finalMood = moodFlag || (moodData && moodData.category !== 'neutral' ? moodData.category : null);
    
    saveLog(input, { shouldCommit: state.autoCommit, mood: finalMood });
    state.lastInput = input;
    state.showHelp = false;
    refresh();
  });

  rl.on('close', () => { 
    if (watcher) watcher.close();
    console.log(`\n\x1b[32m${t('ui.goodbye')}\x1b[0m`); 
    process.exit(0); 
  });
}

module.exports = { startLoop };
