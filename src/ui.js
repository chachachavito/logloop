const readline = require('readline');
const { saveLog, getRecentLogs, updateLastLog, getAnalytics } = require('./core');
const { saveConfig } = require('./config');
const { t } = require('./i18n');
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

  const refresh = () => {
    clear();
    console.log(`\x1b[1m${t('ui.title')} ${t('ui.version')}\x1b[0m`);
    console.log(`\x1b[90m${t('ui.branch')} ${require('./git').getGitMetadata().branch || 'n/a'} | ${t('ui.config')} ${config.storage} | ${t('ui.commit')} ${autoCommit ? 'ON' : 'OFF'} | ${t('ui.mood')} ${config.moodTracking ? 'ON' : 'OFF'}\x1b[0m\n`);
    
    if (lastLogs.length > 0) {
      lastLogs.forEach(log => {
        const moodIcon = log.mood && log.mood !== 'null' ? ` [${log.mood}]` : '';
        console.log(`\x1b[90m[${log.time}] [${log.type}]${moodIcon}\x1b[0m ${log.note}`);
      });
    } else {
      console.log(`\x1b[90m${t('ui.noLogs')}\x1b[0m`);
    }
    
    console.log(`\n\x1b[90m${t('ui.footerDivider')}\x1b[0m`);
    if (helpVisible) {
      console.log(`\x1b[90m${t('ui.helpTitle')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdCommit')}   ${t('ui.cmdMood')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdStorage')}  ${t('ui.cmdEdit')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdTimeline')} ${t('ui.cmdSummary')}\x1b[0m`);
      console.log(`\x1b[90m${t('ui.cmdQuit')}     ${t('ui.cmdHelpClose')}\x1b[0m`);
    }
    console.log(`\x1b[33m${t('ui.promptHelp')}\x1b[0m`);
    rl.prompt();
  };

  refresh();

  rl.on('line', (line) => {
    const input = line.trim();
    if (!input) { refresh(); return; }

    if (input.startsWith('/')) {
      const cmd = input.toLowerCase();
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
        case '/e':
          const logFile = require('./core').getLogFile(config);
          try {
            const editor = process.env.EDITOR || 'nano';
            execSync(`${editor} ${logFile}`, { stdio: 'inherit' });
          } catch (e) {
            console.log(t('ui.errorEditor'));
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
        default:
          console.log(`\x1b[31m${t('ui.unknownCommand')}\x1b[0m`);
          setTimeout(refresh, 1000);
          return;
      }
      refresh();
      return;
    }

    try {
      saveLog(input, config, { shouldCommit: autoCommit, mood: currentMood });
      lastLogs = getRecentLogs(config, 3);
      refresh();
    } catch (err) {
      console.error(`\x1b[31m[logloop] Error: ${err.message}\x1b[0m`);
      setTimeout(refresh, 2000);
    }
  });

  rl.on('close', () => {
    console.log(`\n\x1b[32m${t('ui.goodbye')}\x1b[0m`);
    process.exit(0);
  });
}

module.exports = { startLoop, handleList, renderTimeline, renderSummary };
