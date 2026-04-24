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
      const moodEmoji = moodMap[log.mood] || '📝';
      const typeInitial = log.type ? log.type[0].toUpperCase() : 'T';
      console.log(` \x1b[90m${log.time}\x1b[0m \x1b[2m[#${log.id}]\x1b[0m ${moodEmoji} \x1b[1m[${typeInitial}]\x1b[0m ${log.note}`);
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
    console.log(` \x1b[1m/brain-out <f>\x1b[0m Export brain to file`);
    console.log(` \x1b[1m/brain-in <f>\x1b[0m Import brain from file`);
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

      if (cmd === '/brain-out') {
        const dest = arg || 'logloop-brain.json';
        const { exportMemory } = require('./memory');
        if (exportMemory(dest)) console.log(`\x1b[32mBrain exported to ${dest}\x1b[0m`);
        setTimeout(refresh, 1000);
        return;
      }

      if (cmd === '/brain-in') {
        const source = arg;
        if (!source) {
          console.log('\x1b[31mPlease provide a file path\x1b[0m');
          setTimeout(refresh, 1000);
          return;
        }
        const { importMemory } = require('./memory');
        if (importMemory(source)) console.log('\x1b[32mBrain synchronized successfully!\x1b[0m');
        else console.log('\x1b[31mFile not found\x1b[0m');
        setTimeout(refresh, 1000);
        return;
      }

      if (cmd === '/c' || cmd === '/commit') state.autoCommit = !state.autoCommit;
      else if (cmd === '/m' || cmd === '/mood') state.moodTracking = !state.moodTracking;
      else if (cmd === '/h' || cmd === '/help') state.showHelp = !state.showHelp;
      else if (cmd === '/timeline' || cmd === '/stats') {
        showTimeline();
        setTimeout(refresh, 2000);
        return;
      }
      else if (cmd === '/summary') {
        showSummary();
        setTimeout(refresh, 3000);
        return;
      }
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

function showTimeline() {
  const { getStats } = require('./core');
  const stats = getStats(7);
  
  if (!stats) {
    console.log(`\n  \x1b[90m${t('ui.noLogs')}\x1b[0m\n`);
    return;
  }

  const moodMap = {
    happy: '😊', excited: '🚀', tired: '😴', frustrated: '😤', confused: '🤔', neutral: '😐', focused: '🎯'
  };

  console.log(`\n  \x1b[1;35m--- ${t('ui.timelineTitle') || 'WEEKLY PRODUCTIVITY'} ---\x1b[0m\n`);

  Object.keys(stats.timeline).sort().forEach(date => {
    const day = stats.timeline[date];
    const bars = '█'.repeat(Math.min(day.count, 20));
    const emojis = day.moods.map(m => moodMap[m] || '📝').join(' ');
    console.log(`  \x1b[1m${date}\x1b[0m \x1b[36m${bars}\x1b[0m \x1b[90m(${day.count})\x1b[0m  ${emojis}`);
  });

  console.log(`\n  \x1b[1mSUMMARY BY CATEGORY:\x1b[0m`);
  Object.entries(stats.categories).forEach(([cat, count]) => {
    const color = cat === 'decision' ? '\x1b[33m' : cat === 'action' ? '\x1b[32m' : '\x1b[36m';
    console.log(`  ${color}[${cat.toUpperCase()}]\x1b[0m: ${count}`);
  });

  console.log('\n');
}

function showSummary() {
  const { getDailySummary } = require('./core');
  const summary = getDailySummary();
  
  if (!summary || (summary.decisions.length === 0 && summary.topActions.length === 0)) {
    console.log(`\n  \x1b[90m${t('ui.noSummary') || 'No significant activity today yet.'}\x1b[0m\n`);
    return;
  }

  const moodMap = {
    happy: '😊', excited: '🚀', tired: '😴', frustrated: '😤', confused: '🤔', neutral: '😐', focused: '🎯'
  };

  console.log(`\n  \x1b[1;32m--- DAILY SUMMARY ---\x1b[0m`);
  console.log(`  \x1b[90mFocus & Mood:\x1b[0m ${moodMap[summary.mood] || '😐'} (${summary.mood})\n`);

  if (summary.decisions.length > 0) {
    console.log(`  \x1b[1;33mDECISIONS MADE:\x1b[0m`);
    summary.decisions.forEach(d => console.log(`  ✓ ${d}`));
    console.log('');
  }

  if (summary.questions.length > 0) {
    console.log(`  \x1b[1;34mPENDING QUESTIONS:\x1b[0m`);
    summary.questions.forEach(q => console.log(`  ? ${q}`));
    console.log('');
  }

  if (summary.topActions.length > 0) {
    console.log(`  \x1b[1;32mKEY ACTIONS:\x1b[0m`);
    summary.topActions.slice(0, 5).forEach(a => console.log(`  • ${a}`));
  }

  console.log('\n');
}

module.exports = { startLoop, showTimeline, showSummary };
