const readline = require('readline');
const { saveLog, getRecentLogs, updateLastLog, getAnalytics } = require('./core');
const { saveConfig } = require('./config');
const { t } = require('./i18n');
const { learn, exportMemory, importMemory } = require('./memory');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function clear() {
  process.stdout.write('\x1b[2J\x1b[0;0H');
}

function handleList(config) {
  const { GLOBAL_DIR } = require('./config');
  const logsDir = path.join(GLOBAL_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    console.log(t('cli.noLocalLogs'));
    return;
  }
  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log(t('cli.noLocalLogs'));
    return;
  }
  console.log(`\n\x1b[1m${t('cli.listHeader')}\x1b[0m`);
  files.forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const entries = content.split('\n## [').length - 1;
    const project = file.split('.')[0].toUpperCase().padEnd(20);
    const count = entries.toString().padEnd(10);
    const lastUpdate = stats.mtime.toLocaleDateString();
    console.log(`${project} ${count} ${lastUpdate}`);
  });
}

function renderTimeline(analytics) {
  if (!analytics) return console.log(t('analytics.noActivity'));
  console.log(`\n\x1b[1m${t('analytics.timelineTitle')}\x1b[0m`);
  const max = Math.max(...analytics.timeline, 1);
  analytics.timeline.forEach((count, hour) => {
    const label = `${hour.toString().padStart(2, '0')}:00`;
    const bar = '█'.repeat(Math.round((count / max) * 20));
    const color = count > 0 ? '\x1b[36m' : '\x1b[90m';
    console.log(`${color}${label} ${bar.padEnd(20)} (${count})\x1b[0m`);
  });
}

function renderSummary(analytics) {
  if (!analytics) return console.log(t('analytics.noActivity'));
  console.log(`\n\x1b[1m${t('analytics.summaryTitle')}\x1b[0m`);
  
  if (analytics.decisions.length > 0) {
    console.log(`\n\x1b[32m[${t('analytics.decisionsTitle')}]\x1b[0m`);
    analytics.decisions.forEach(d => console.log(` \x1b[32m✓\x1b[0m ${d}`));
  }

  if (analytics.questions.length > 0) {
    console.log(`\n\x1b[33m[${t('analytics.questionsTitle')}]\x1b[0m`);
    analytics.questions.forEach(q => console.log(` \x1b[33m?\x1b[0m ${q}`));
  }

  console.log(`\n\x1b[35m[${t('analytics.moodBalance')}]\x1b[0m`);
  Object.entries(analytics.moods).forEach(([mood, count]) => {
    console.log(` ${mood}: ${'█'.repeat(count)} (${count})`);
  });
}

function startLoop(config, initialMood = null, initialCommit = null) {
  let currentMood = initialMood;
  let autoCommit = initialCommit !== null ? initialCommit : config.autoCommit;
  let helpVisible = true;
  let lastLogs = getRecentLogs(config, 3);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\x1b[35m› \x1b[0m`
  });

  const refresh = (msg = '') => {
    clear();
    console.log(`\x1b[1m${t('ui.title')} ${t('ui.version')}\x1b[0m`);
    const git = require('./git').getGitMetadata() || {};
    const branchName = git.branch || 'no git context';
    console.log(`\x1b[90m${t('ui.branch')} ${branchName} | ${t('ui.config')} ${config.storage} | ${t('ui.commit')} ${autoCommit ? 'ON' : 'OFF'} | ${t('ui.mood')} ${config.moodTracking ? 'ON' : 'OFF'} | TRAIN ${config.trainingMode ? 'ON' : 'OFF'}\x1b[0m\n`);
    
    if (lastLogs.length > 0) {
      lastLogs.forEach(log => {
        const moodIcon = log.mood && log.mood !== 'null' ? ` [${log.mood}]` : '';
        const displayNote = log.note.replace(/\n/g, ' ');
        console.log(`\x1b[90m[${log.time}] [${log.type}]${moodIcon}\x1b[0m ${displayNote}`);
      });
    } else {
      console.log(`\x1b[90m${t('ui.noLogs')}\x1b[0m`);
    }
    
    console.log(`\n\x1b[90m${t('ui.footerDivider')}\x1b[0m`);
    if (helpVisible) {
      console.log(`\x1b[90m${t('ui.helpTitle')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdCommit').padEnd(30)} ${t('ui.cmdMood')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdAs').padEnd(30)} ${t('ui.cmdFeel')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdTrain').padEnd(30)} ${t('ui.cmdStorage')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdBrainOut').padEnd(30)} ${t('ui.cmdBrainIn')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdTimeline').padEnd(30)} ${t('ui.cmdSummary')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdEdit').padEnd(30)} ${t('ui.cmdHelpClose')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdQuit')}\x1b[0m`);
    }
    if (msg) console.log(`\n${msg}`);
    console.log(`\x1b[33m${t('ui.promptHelp')}\x1b[0m`);
    rl.prompt();
  };

  refresh();

  let lineBuffer = [];
  let bufferTimeout = null;

  const processInput = (input) => {
    if (!input || !input.trim()) { refresh(); return; }

    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');

      switch (cmd) {
        case '/q': rl.close(); return;
        case '/h': helpVisible = !helpVisible; break;
        case '/c': autoCommit = !autoCommit; break;
        case '/m': 
          config.moodTracking = !config.moodTracking; 
          saveConfig(config);
          break;
        case '/s':
          config.storage = config.storage === 'repo' ? 'local' : 'repo';
          saveConfig(config);
          break;
        case '/t':
          config.trainingMode = !config.trainingMode;
          saveConfig(config);
          break;
        case '/e':
          const logFile = require('./core').getLogFile(config);
          try {
            const editor = process.env.EDITOR || 'nano';
            execSync(`${editor} ${logFile}`, { stdio: 'inherit' });
          } catch (e) {
            refresh(`\x1b[31m${t('ui.errorEditor')}\x1b[0m`);
            return;
          }
          break;
        case '/timeline':
          clear();
          renderTimeline(getAnalytics(config));
          console.log(`\n\x1b[90m${t('ui.footerDivider')}\x1b[0m`);
          console.log(`\x1b[33m${t('ui.promptHelp')}\x1b[0m`);
          rl.prompt();
          return;
        case '/summary':
          clear();
          renderSummary(getAnalytics(config));
          console.log(`\n\x1b[90m${t('ui.footerDivider')}\x1b[0m`);
          console.log(`\x1b[33m${t('ui.promptHelp')}\x1b[0m`);
          rl.prompt();
          return;
        case '/as':
          if (!arg) { refresh(`\x1b[31mUsage: /as <type>\x1b[0m`); return; }
          if (lastLogs.length === 0) { refresh(`\x1b[31m${t('ui.noLogToTrain')}\x1b[0m`); return; }
          const lastLogAs = lastLogs[lastLogs.length - 1];
          updateLastLog({ type: arg }, config);
          learn(lastLogAs.note, arg, arg, 'message');
          lastLogs = getRecentLogs(config, 3);
          refresh(`\x1b[32m${t('ui.brainTrained')}\x1b[0m \x1b[1m${lastLogAs.note}\x1b[0m → \x1b[36m${arg}\x1b[0m`);
          return;
        case '/feel':
          if (!arg) { refresh(`\x1b[31mUsage: /feel <mood>\x1b[0m`); return; }
          if (lastLogs.length === 0) { refresh(`\x1b[31m${t('ui.noLogToTrain')}\x1b[0m`); return; }
          const lastLogFeel = lastLogs[lastLogs.length - 1];
          updateLastLog({ mood: arg }, config);
          learn(lastLogFeel.note, arg, arg, 'mood');
          lastLogs = getRecentLogs(config, 3);
          refresh(`\x1b[32m${t('ui.brainTrained')}\x1b[0m \x1b[1m${lastLogFeel.note}\x1b[0m → \x1b[35m${arg}\x1b[0m`);
          return;
        case '/brain-out':
          if (!arg) { refresh(`\x1b[31mUsage: /brain-out <file>\x1b[0m`); return; }
          if (exportMemory(arg)) {
            refresh(`\x1b[32m${t('ui.brainExported')}\x1b[0m ${arg}`);
          } else {
            refresh(`\x1b[31m${t('ui.brainError')}\x1b[0m`);
          }
          return;
        case '/brain-in':
          if (!arg) { refresh(`\x1b[31mUsage: /brain-in <file>\x1b[0m`); return; }
          if (importMemory(arg)) {
            refresh(`\x1b[32m${t('ui.brainSynced')}\x1b[0m`);
          } else {
            refresh(`\x1b[31m${t('ui.brainError')}\x1b[0m`);
          }
          return;
        default:
          console.log(`\x1b[31m${t('ui.unknownCommand')}\x1b[0m`);
          setTimeout(refresh, 1000);
          return;
      }
      refresh();
      return;
    }

    try {
      if (config.trainingMode) {
        const { classifyMessage, classifyMood } = require('./classifier');
        const detectedType = classifyMessage(input).category;
        const detectedMood = classifyMood(input).category;
        
        const types = ['action', 'decision', 'question', 'media', 'noise', 'thought'];
        const moods = ['happy', 'focused', 'tired', 'frustrated', 'confused', 'excited', 'neutral'];

        const typeLine = `\x1b[1m\x1b[36mTYPE\x1b[0m \x1b[90m›\x1b[0m \x1b[1m${detectedType.padEnd(10)}\x1b[0m \x1b[90m${types.map((t, i) => `${i+1}.${t}`).join(' ')}\x1b[0m`;
        rl.question(`${typeLine}\n\x1b[36m› \x1b[0m`, (typeIdx) => {
          let finalType = detectedType;
          const tidx = parseInt(typeIdx.trim()) - 1;
          if (types[tidx]) finalType = types[tidx];

          const moodLine = `\x1b[1m\x1b[35mMOOD\x1b[0m \x1b[90m›\x1b[0m \x1b[1m${detectedMood.padEnd(10)}\x1b[0m \x1b[90m${moods.map((m, i) => `${i+1}.${m}`).join(' ')}\x1b[0m`;
          rl.question(`${moodLine}\n\x1b[35m› \x1b[0m`, (moodIdx) => {
            let finalMood = detectedMood;
            const midx = parseInt(moodIdx.trim()) - 1;
            if (moods[midx]) finalMood = moods[midx];

            if (finalType !== detectedType) learn(input, finalType, finalType, 'message');
            if (finalMood !== detectedMood) learn(input, finalMood, finalMood, 'mood');

            saveLog(input, config, { shouldCommit: autoCommit, mood: finalMood, type: finalType });
            lastLogs = getRecentLogs(config, 3);
            refresh();
          });
        });
        return;
      }

      saveLog(input, config, { shouldCommit: autoCommit, mood: currentMood });
      lastLogs = getRecentLogs(config, 3);
      refresh();
    } catch (err) {
      console.error(`\x1b[31m[logloop] Error: ${err.message}\x1b[0m`);
      setTimeout(refresh, 2000);
    }
  };

  const flushBuffer = () => {
    if (lineBuffer.length === 0) return;
    const combined = lineBuffer.join('\n');
    lineBuffer = [];
    processInput(combined);
  };

  rl.on('line', (line) => {
    if (line.trim().startsWith('/')) {
      flushBuffer();
      processInput(line.trim());
      return;
    }

    lineBuffer.push(line);
    if (bufferTimeout) clearTimeout(bufferTimeout);
    bufferTimeout = setTimeout(flushBuffer, 50);
  });

  rl.on('close', () => {
    console.log(`\n\x1b[32m${t('ui.goodbye')}\x1b[0m`);
    process.exit(0);
  });
}

module.exports = { startLoop, handleList, renderTimeline, renderSummary };
