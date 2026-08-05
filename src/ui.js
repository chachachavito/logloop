import readline from 'readline';
import { saveLog, getRecentLogs, updateLastLog, getAnalytics, getLogFile, getGlobalLogs as fetchGlobalLogs, parseLogTimestamp } from './core.js';
import { saveConfig, GLOBAL_DIR } from './config.js';
import { t } from './i18n.js';
import { learn, exportMemory, importMemory } from './memory.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pc from 'picocolors';
import { createRequire } from 'module';
import { getGitMetadata } from './git.js';
import { classifyMessage, classifyMood } from './classifier.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

function clear() {
  process.stdout.write('\x1b[2J\x1b[0;0H');
}

export async function handleList(config) {
  const { list: dbList } = await import('./db.js');
  const logs = await dbList('logs');
  
  if (logs.length === 0) {
    console.log(t('cli.noLocalLogs'));
    return;
  }

  const projects = {};
  logs.forEach(log => {
    const p = log.project || 'unknown';
    if (!projects[p]) projects[p] = { count: 0, lastUpdate: log.timestamp };
    projects[p].count++;
    if (log.timestamp > projects[p].lastUpdate) projects[p].lastUpdate = log.timestamp;
  });

  console.log(`\n${pc.bold(t('cli.listHeader'))}`);
  Object.entries(projects).forEach(([name, data]) => {
    const project = name.toUpperCase().padEnd(20);
    const count = data.count.toString().padEnd(10);
    const lastUpdated = parseLogTimestamp(data.lastUpdate);
    const lastUpdate = lastUpdated ? lastUpdated.toLocaleDateString() : 'unknown';
    console.log(`${project} ${count} ${lastUpdate}`);
  });
}

export function renderGlobalList(logs, title = null) {
  if (logs.length === 0) {
    console.log(pc.gray(t('ui.noLogs') || 'No logs found.'));
    return;
  }
  console.log(`\n${pc.bold(title || t('cli.globalListHeader') || 'GLOBAL LOGS')}`);
  console.log(pc.gray('─'.repeat(85)));
  logs.forEach(log => {
    const project = pc.magenta((log.project || 'unknown').toUpperCase().padEnd(12));
    const time = pc.gray(log.rawTime ? log.rawTime.split('T')[0] : 'unknown');
    const type = pc.cyan(`[${log.type}]`.padEnd(10));
    const mood = log.mood && log.mood !== 'null' ? pc.yellow(`[${log.mood}] `) : '';
    const note = log.note.replace(/\n/g, ' ');
    const displayNote = note.length > 50 ? note.substring(0, 47) + '...' : note;
    console.log(`${project} ${time} ${type} ${mood}${pc.white(displayNote)}`);
  });
}

export function renderTimeline(analytics) {
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

export function renderSummary(analytics) {
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

export async function startLoop(config, initialMood = null, initialCommit = null) {
  let currentMood = initialMood;
  let autoCommit = initialCommit !== null ? initialCommit : config.autoCommit;
  let helpVisible = !config.zenMode;
  let lastLogs = await getRecentLogs(config, 3);

    const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: pc.magenta('› ')
  });

  const refresh = (msg = '') => {
    clear();
    // Premium Header
    console.log(`${pc.bold(pc.white('LOGLOOP'))} ${pc.gray('──────')} ${pc.gray(`v${pkg.version}`)}`);
    
    const git = getGitMetadata() || {};
    const projectName = path.basename(process.cwd());
    const shortHash = git.hash ? ` (${git.hash.substring(0, 7)})` : '';
    
    // Status Bar - Compact & Elegant
    const status = [
      `${pc.gray('project:')} ${pc.magenta(pc.bold(projectName))}`,
      `${pc.gray('branch:')} ${pc.cyan((git.branch || 'none') + shortHash)}`,
      `${pc.gray('commit:')} ${autoCommit ? pc.green('ON') : pc.red('OFF')}`,
      `${pc.gray('mood:')} ${config.moodTracking ? pc.green('ON') : pc.red('OFF')}`,
      `${pc.gray('train:')} ${config.trainingMode ? pc.green('ON') : pc.red('OFF')}`
    ].join(pc.gray(' • '));
    
    console.log(status + '\n');
    
    // Clean Logs
    if (lastLogs.length > 0) {
      lastLogs.forEach(log => {
        const time = pc.gray(log.time);
        const moodIcon = log.mood && log.mood !== 'null' ? ` [${log.mood}]` : '';
        const meta = pc.gray(`[${log.type}]${moodIcon}`);
        const displayNote = log.note.replace(/\n/g, ' ');
        console.log(`${time} ${meta} ${pc.white(displayNote)}`);
      });
    } else {
      console.log(pc.gray('  ' + t('ui.noLogs')));
    }
    
    console.log(`\n${pc.gray('─'.repeat(85))}`);

    if (helpVisible) {
      console.log(pc.bold(pc.white('  COMMANDS HELP')));
      
      const col1 = [
        `${pc.bold('/c')} Toggle Commit`,
        `${pc.bold('/m')} Toggle Mood`,
        `${pc.bold('/s')} Toggle Storage`,
        `${pc.bold('/t')} Toggle Train`
      ];
      const col2 = [
        `${pc.bold('/timeline')} Activity`,
        `${pc.bold('/global')}   Global History`,
        `${pc.bold('/summary')}  Insights`,
        `${pc.bold('/q')}        Quit`
      ];
      const col3 = [
        `${pc.bold('/as')}    Train Type`,
        `${pc.bold('/feel')}  Train Mood`,
        `${pc.bold('/brain-out')} Export`,
        `${pc.bold('/e')}     Edit File`,
        `${pc.bold('/h')}     Close Help`
      ];

      for (let i = 0; i < 5; i++) {
        console.log(`  ${(col1[i] || '').padEnd(35)} ${(col2[i] || '').padEnd(35)} ${(col3[i] || '')}`);
      }
      console.log(pc.gray('─'.repeat(85)));
    }

    if (msg) console.log(`${msg}`);
    console.log(`${pc.magenta('›')} ${pc.gray(t('ui.promptHelp'))}`);
    rl.prompt();
  };

  refresh();

  let lineBuffer = [];
  let bufferTimeout = null;

  const processInput = async (input) => {
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
          await saveConfig(config);
          break;
        case '/c': autoCommit = !autoCommit; break;
        case '/m': 
          config.moodTracking = !config.moodTracking; 
          await saveConfig(config);
          break;
        case '/s':
          config.storage = config.storage === 'repo' ? 'local' : 'repo';
          await saveConfig(config);
          break;
        case '/t':
          config.trainingMode = !config.trainingMode;
          await saveConfig(config);
          break;
        case '/e':
          const logFile = getLogFile(config);
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
          renderTimeline(await getAnalytics(config));
          console.log(`\n${pc.gray(t('ui.footerDivider'))}`);
          console.log(pc.yellow(`↵ ${t('ui.pressEnterToReturn') || 'Press Enter to return'}`));
          rl.prompt();
          return;
        case '/global':
          clear();
          renderGlobalList(await fetchGlobalLogs());
          console.log(`\n${pc.gray(t('ui.footerDivider'))}`);
          console.log(pc.yellow(`↵ ${t('ui.pressEnterToReturn') || 'Press Enter to return'}`));
          rl.prompt();
          return;
        case '/summary':
          clear();
          renderSummary(await getAnalytics(config));
          console.log(`\n${pc.gray(t('ui.footerDivider'))}`);
          console.log(pc.yellow(`↵ ${t('ui.pressEnterToReturn') || 'Press Enter to return'}`));
          rl.prompt();
          return;
        case '/as':
          if (!arg) { refresh(pc.red('Usage: /as <type>')); return; }
          if (lastLogs.length === 0) { refresh(pc.red(t('ui.noLogToTrain'))); return; }
          const lastLogAs = lastLogs[lastLogs.length - 1];
          updateLastLog({ type: arg }, config);
          await learn(lastLogAs.note, arg, arg, 'message');
          lastLogs = await getRecentLogs(config, 3);
          refresh(`${pc.green(t('ui.brainTrained'))} ${pc.bold(lastLogAs.note)} → ${pc.cyan(arg)}`);
          return;
        case '/feel':
          if (!arg) { refresh(pc.red('Usage: /feel <mood>')); return; }
          if (lastLogs.length === 0) { refresh(pc.red(t('ui.noLogToTrain'))); return; }
          const lastLogFeel = lastLogs[lastLogs.length - 1];
          updateLastLog({ mood: arg }, config);
          await learn(lastLogFeel.note, arg, arg, 'mood');
          lastLogs = await getRecentLogs(config, 3);
          refresh(`${pc.green(t('ui.brainTrained'))} ${pc.bold(lastLogFeel.note)} → ${pc.magenta(arg)}`);
          return;
        case '/brain-out':
          if (!arg) { refresh(pc.red('Usage: /brain-out <file>')); return; }
          if (await exportMemory(arg)) {
            refresh(`${pc.green(t('ui.brainExported'))} ${arg}`);
          } else {
            refresh(pc.red(t('ui.brainError')));
          }
          return;
        case '/brain-in':
          if (!arg) { refresh(pc.red('Usage: /brain-in <file>')); return; }
          if (await importMemory(arg)) {
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
        const detectedType = (await classifyMessage(input)).category;
        const detectedMood = (await classifyMood(input)).category;
        
        const types = ['action', 'decision', 'question', 'media', 'noise', 'thought'];
        const moods = ['happy', 'focused', 'tired', 'frustrated', 'confused', 'excited', 'neutral'];

        const typeLine = `${pc.bold(pc.cyan('TYPE'))} ${pc.gray('›')} ${pc.bold(detectedType.padEnd(10))} ${pc.gray(types.map((t, i) => `${i+1}.${t}`).join(' '))}`;
        rl.question(`${typeLine}\n${pc.cyan('› ')}`, async (typeIdx) => {
          let finalType = detectedType;
          const tidx = parseInt(typeIdx.trim()) - 1;
          if (types[tidx]) finalType = types[tidx];

          const moodLine = `${pc.bold(pc.magenta('MOOD'))} ${pc.gray('›')} ${pc.bold(detectedMood.padEnd(10))} ${pc.gray(moods.map((m, i) => `${i+1}.${m}`).join(' '))}`;
          rl.question(`${moodLine}\n${pc.magenta('› ')}`, async (moodIdx) => {
            let finalMood = detectedMood;
            const midx = parseInt(moodIdx.trim()) - 1;
            if (moods[midx]) finalMood = moods[midx];

            if (finalType !== detectedType) await learn(input, finalType, finalType, 'message');
            if (finalMood !== detectedMood) await learn(input, finalMood, finalMood, 'mood');

            await saveLog(input, config, { shouldCommit: autoCommit, mood: finalMood, type: finalType });
            lastLogs = await getRecentLogs(config, 3);
            refresh();
          });
        });
        return;
      }

      let finalMood = currentMood;
      if (config.moodTracking && !finalMood) {
        finalMood = (await classifyMood(input)).category;
      }
      await saveLog(input, config, { shouldCommit: autoCommit, mood: finalMood });
      lastLogs = await getRecentLogs(config, 3);
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
    console.log(`\n${pc.bold(pc.magenta('Git tracks WHAT changed.'))}`);
    console.log(`${pc.bold(pc.green('Logloop tracks WHY.'))}\n`);
    process.exit(0);
  });
}
