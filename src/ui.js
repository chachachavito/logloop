const readline = require('readline');
const { saveLog, getRecentLogs, updateLastLog, getAnalytics } = require('./core');
const { saveConfig } = require('./config');
const { t } = require('./i18n');
const { learn, exportMemory, importMemory } = require('./memory');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pc = require('picocolors');

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
  console.log(`\n${pc.bold(t('cli.listHeader'))}`);
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
  console.log(`\n${pc.bold(t('analytics.timelineTitle'))}`);
  const max = Math.max(...analytics.timeline, 1);
  analytics.timeline.forEach((count, hour) => {
    const label = `${hour.toString().padStart(2, '0')}:00`;
    const bar = '█'.repeat(Math.round((count / max) * 20));
    const output = `${label} ${bar.padEnd(20)} (${count})`;
    console.log(count > 0 ? pc.cyan(output) : pc.gray(output));
  });
}

function renderSummary(analytics) {
  if (!analytics) return console.log(t('analytics.noActivity'));
  console.log(`\n${pc.bold(t('analytics.summaryTitle'))}`);
  
  if (analytics.decisions.length > 0) {
    console.log(`\n${pc.green(`[${t('analytics.decisionsTitle')}]`)}`);
    analytics.decisions.forEach(d => console.log(` ${pc.green('✓')} ${d}`));
  }

  if (analytics.questions.length > 0) {
    console.log(`\n${pc.yellow(`[${t('analytics.questionsTitle')}]`)}`);
    analytics.questions.forEach(q => console.log(` ${pc.yellow('?')} ${q}`));
  }

  console.log(`\n${pc.magenta(`[${t('analytics.moodBalance')}]`)}`);
  Object.entries(analytics.moods).forEach(([mood, count]) => {
    console.log(` ${mood}: ${'█'.repeat(count)} (${count})`);
  });
}

function startLoop(config, initialMood = null, initialCommit = null) {
  let currentMood = initialMood;
  let autoCommit = initialCommit !== null ? initialCommit : config.autoCommit;
  let helpVisible = !config.zenMode;
  let lastLogs = getRecentLogs(config, 3);

    const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: pc.magenta('› ')
  });

  const refresh = (msg = '') => {
    clear();
    console.log(pc.bold(`${t('ui.title')} ${t('ui.version')}`));
    const git = require('./git').getGitMetadata() || {};
    const branchName = git.branch || 'no git context';
    console.log(pc.gray(`${t('ui.branch')} ${branchName} | ${t('ui.config')} ${config.storage} | ${t('ui.commit')} ${autoCommit ? 'ON' : 'OFF'} | ${t('ui.mood')} ${config.moodTracking ? 'ON' : 'OFF'} | TRAIN ${config.trainingMode ? 'ON' : 'OFF'}\n`));
    
    if (lastLogs.length > 0) {
      lastLogs.forEach(log => {
        const moodIcon = log.mood && log.mood !== 'null' ? ` [${log.mood}]` : '';
        const displayNote = log.note.replace(/\n/g, ' ');
        console.log(`${pc.gray(`[${log.time}] [${log.type}]${moodIcon}`)} ${displayNote}`);
      });
    } else {
      console.log(pc.gray(t('ui.noLogs')));
    }
    
    console.log(`\n${pc.gray(t('ui.footerDivider'))}`);
    if (helpVisible) {
      console.log(pc.gray(t('ui.helpTitle')));
      console.log(pc.gray(`${t('ui.cmdCommit').padEnd(30)} ${t('ui.cmdMood')}`));
      console.log(pc.gray(`${t('ui.cmdAs').padEnd(30)} ${t('ui.cmdFeel')}`));
      console.log(pc.gray(`${t('ui.cmdTrain').padEnd(30)} ${t('ui.cmdStorage')}`));
      console.log(pc.gray(`${t('ui.cmdBrainOut').padEnd(30)} ${t('ui.cmdBrainIn')}`));
      console.log(pc.gray(`${t('ui.cmdTimeline').padEnd(30)} ${t('ui.cmdSummary')}`));
      console.log(pc.gray(`${t('ui.cmdEdit').padEnd(30)} ${t('ui.cmdHelpClose')}`));
      console.log(pc.gray(t('ui.cmdQuit')));
    }
    if (msg) console.log(`\n${msg}`);
    console.log(pc.yellow(t('ui.promptHelp')));
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
        case '/h':
        case '/zen':
          helpVisible = !helpVisible;
          config.zenMode = !helpVisible;
          saveConfig(config);
          break;
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
            refresh(pc.red(t('ui.errorEditor')));
            return;
          }
          break;
        case '/timeline':
          clear();
          renderTimeline(getAnalytics(config));
          console.log(`\n${pc.gray(t('ui.footerDivider'))}`);
          console.log(pc.yellow(t('ui.promptHelp')));
          rl.prompt();
          return;
        case '/summary':
          clear();
          renderSummary(getAnalytics(config));
          console.log(`\n${pc.gray(t('ui.footerDivider'))}`);
          console.log(pc.yellow(t('ui.promptHelp')));
          rl.prompt();
          return;
        case '/as':
          if (!arg) { refresh(pc.red('Usage: /as <type>')); return; }
          if (lastLogs.length === 0) { refresh(pc.red(t('ui.noLogToTrain'))); return; }
          const lastLogAs = lastLogs[lastLogs.length - 1];
          updateLastLog({ type: arg }, config);
          learn(lastLogAs.note, arg, arg, 'message');
          lastLogs = getRecentLogs(config, 3);
          refresh(`${pc.green(t('ui.brainTrained'))} ${pc.bold(lastLogAs.note)} → ${pc.cyan(arg)}`);
          return;
        case '/feel':
          if (!arg) { refresh(pc.red('Usage: /feel <mood>')); return; }
          if (lastLogs.length === 0) { refresh(pc.red(t('ui.noLogToTrain'))); return; }
          const lastLogFeel = lastLogs[lastLogs.length - 1];
          updateLastLog({ mood: arg }, config);
          learn(lastLogFeel.note, arg, arg, 'mood');
          lastLogs = getRecentLogs(config, 3);
          refresh(`${pc.green(t('ui.brainTrained'))} ${pc.bold(lastLogFeel.note)} → ${pc.magenta(arg)}`);
          return;
        case '/brain-out':
          if (!arg) { refresh(pc.red('Usage: /brain-out <file>')); return; }
          if (exportMemory(arg)) {
            refresh(`${pc.green(t('ui.brainExported'))} ${arg}`);
          } else {
            refresh(pc.red(t('ui.brainError')));
          }
          return;
        case '/brain-in':
          if (!arg) { refresh(pc.red('Usage: /brain-in <file>')); return; }
          if (importMemory(arg)) {
            refresh(pc.green(t('ui.brainSynced')));
          } else {
            refresh(pc.red(t('ui.brainError')));
          }
          return;
        default:
          console.log(pc.red(t('ui.unknownCommand')));
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

        const typeLine = `${pc.bold(pc.cyan('TYPE'))} ${pc.gray('›')} ${pc.bold(detectedType.padEnd(10))} ${pc.gray(types.map((t, i) => `${i+1}.${t}`).join(' '))}`;
        rl.question(`${typeLine}\n${pc.cyan('› ')}`, (typeIdx) => {
          let finalType = detectedType;
          const tidx = parseInt(typeIdx.trim()) - 1;
          if (types[tidx]) finalType = types[tidx];

          const moodLine = `${pc.bold(pc.magenta('MOOD'))} ${pc.gray('›')} ${pc.bold(detectedMood.padEnd(10))} ${pc.gray(moods.map((m, i) => `${i+1}.${m}`).join(' '))}`;
          rl.question(`${moodLine}\n${pc.magenta('› ')}`, (moodIdx) => {
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
      console.error(pc.red(`[logloop] Error: ${err.message}`));
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
    console.log(`\n${pc.green(t('ui.goodbye'))}`);
    process.exit(0);
  });
}

module.exports = { startLoop, handleList, renderTimeline, renderSummary };
